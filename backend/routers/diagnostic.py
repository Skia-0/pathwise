from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from routers.subjects import ensure_subject_row
from models.schemas import DiagnosticSubmission, DiagnosticProgress
from db.supabase_client import supabase
from quiz_utils import prepare_question
from datetime import datetime, timezone, timedelta
import random
import secrets
import uuid

router = APIRouter()

STALE_AFTER_DAYS = 14
QUIZ_SIZE = {"easy": 6, "medium": 8, "hard": 6}
VALID_KEYS = {"A", "B", "C", "D"}


# ── Scoring helpers ───────────────────────────────────────
def calculate_aptitude_tier(score: float) -> str:
    if score >= 70:
        return "advanced"
    elif score >= 40:
        return "intermediate"
    else:
        return "beginner"


def calculate_topic_breakdown(questions: list, answers: dict) -> dict:
    topic_stats = {}
    for q in questions:
        topic = q["topic"]
        q_id = q["id"]
        if topic not in topic_stats:
            topic_stats[topic] = {"correct": 0, "total": 0}
        topic_stats[topic]["total"] += 1
        if answers.get(q_id) == q["correct_answer"]:
            topic_stats[topic]["correct"] += 1

    breakdown = {}
    for topic, stats in topic_stats.items():
        accuracy = (stats["correct"] / stats["total"]) * 100
        breakdown[topic] = round(accuracy, 1)
    return breakdown


# ── Attempt helpers ───────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_answers(answers: dict, allowed: set) -> dict:
    """Keep only answers for this attempt's questions, with valid letters."""
    cleaned = {}
    for question_id, key in answers.items():
        if question_id in allowed and isinstance(key, str) and key.upper() in VALID_KEYS:
            cleaned[question_id] = key.upper()
    return cleaned


def get_attempt(attempt_id: str, user_id: str) -> dict:
    try:
        uuid.UUID(attempt_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail="Diagnostic attempt not found")

    result = supabase.table("diagnostic_attempts").select("*").eq(
        "id", attempt_id
    ).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Diagnostic attempt not found")
    return result.data[0]


def find_open_attempt(user_id: str, subject: str):
    result = supabase.table("diagnostic_attempts").select("*").eq(
        "user_id", user_id
    ).eq("subject", subject).eq("status", "in_progress").execute()
    return result.data[0] if result.data else None


def load_attempt_questions(attempt: dict) -> dict:
    rows = supabase.table("questions").select("*").in_(
        "id", attempt["question_ids"]
    ).execute().data
    return {q["id"]: q for q in rows}


def is_stale(attempt: dict) -> bool:
    stamp = attempt.get("updated_at") or attempt.get("started_at")
    try:
        last = datetime.fromisoformat(stamp)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return False
    return datetime.now(timezone.utc) - last > timedelta(days=STALE_AFTER_DAYS)


def abandon_attempt(attempt_id: str):
    supabase.table("diagnostic_attempts").update(
        {"status": "abandoned", "updated_at": now_iso()}
    ).eq("id", attempt_id).execute()


def sample_questions(subject: str) -> list:
    selected = []
    for difficulty, count in QUIZ_SIZE.items():
        pool = supabase.table("questions").select("*").eq(
            "subject", subject
        ).eq("difficulty", difficulty).execute().data
        selected += random.sample(pool, min(count, len(pool)))

    if len(selected) < 5:
        raise HTTPException(
            status_code=404,
            detail=f"Not enough {subject} questions available yet"
        )
    random.shuffle(selected)
    return selected


def build_payload(attempt: dict, questions_by_id: dict, resumed: bool, notice=None) -> dict:
    prepared = []
    for question_id in attempt["question_ids"]:
        q = questions_by_id[question_id]
        prepared.append(
            prepare_question(q, seed=f"{attempt['shuffle_seed']}:{question_id}")
        )
    return {
        "attempt_id": attempt["id"],
        "subject": attempt["subject"],
        "questions": prepared,
        "total": len(prepared),
        "answers": attempt.get("answers") or {},
        "current_index": attempt.get("current_index") or 0,
        "resumed": resumed,
        "notice": notice,
    }


def usable_payload(attempt: dict):
    """Return (payload, None) if the attempt can be resumed, else (None, reason)."""
    if is_stale(attempt):
        return None, "Your previous diagnostic was left for too long, so we started a fresh one."

    questions_by_id = load_attempt_questions(attempt)
    if len(questions_by_id) != len(attempt["question_ids"]):
        return None, "The question bank was updated since you started, so we began a new diagnostic."

    answers = attempt.get("answers") or {}
    return build_payload(attempt, questions_by_id, resumed=bool(answers)), None


# ── Routes ────────────────────────────────────────────────
@router.post("/start")
def start_diagnostic(user_id: str = Depends(get_current_user)):
    """Start the diagnostic for the active subject, or resume the open attempt."""
    user = supabase.table("users").select("subject, aptitude_tier").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]

    if user.data[0]["aptitude_tier"]:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "already_completed",
                "message": "You have already completed the diagnostic for this subject."
            }
        )

    notice = None
    open_attempt = find_open_attempt(user_id, subject)
    if open_attempt:
        payload, reason = usable_payload(open_attempt)
        if payload:
            return payload
        abandon_attempt(open_attempt["id"])
        notice = reason

    selected = sample_questions(subject)

    try:
        created = supabase.table("diagnostic_attempts").insert({
            "user_id": user_id,
            "subject": subject,
            "question_ids": [q["id"] for q in selected],
            "answers": {},
            "current_index": 0,
            "shuffle_seed": secrets.token_hex(8),
        }).execute()
        attempt = created.data[0]
    except Exception:
        # Another tab created the attempt at the same moment. Use that one.
        attempt = find_open_attempt(user_id, subject)
        if not attempt:
            raise HTTPException(status_code=500, detail="Could not start the diagnostic. Please try again.")
        payload, _ = usable_payload(attempt)
        if payload:
            return payload
        raise HTTPException(status_code=500, detail="Could not start the diagnostic. Please try again.")

    questions_by_id = {q["id"]: q for q in selected}
    return build_payload(attempt, questions_by_id, resumed=False, notice=notice)


@router.patch("/progress")
def save_progress(
    progress: DiagnosticProgress,
    user_id: str = Depends(get_current_user)
):
    """Autosave. The client sends all its answers each time, so a lost request costs nothing."""
    attempt = get_attempt(progress.attempt_id, user_id)

    if attempt["status"] != "in_progress":
        raise HTTPException(
            status_code=409,
            detail={"code": "attempt_closed", "message": "This diagnostic is already finished."}
        )

    allowed = set(attempt["question_ids"])
    merged = {**(attempt.get("answers") or {}), **clean_answers(progress.answers, allowed)}
    index = max(0, min(progress.current_index, len(attempt["question_ids"]) - 1))

    supabase.table("diagnostic_attempts").update({
        "answers": merged,
        "current_index": index,
        "updated_at": now_iso(),
    }).eq("id", attempt["id"]).execute()

    return {"saved": len(merged), "total": len(allowed)}


@router.post("/submit")
def submit_diagnostic(
    submission: DiagnosticSubmission,
    user_id: str = Depends(get_current_user)
):
    attempt = get_attempt(submission.attempt_id, user_id)

    # Retrying a submit that already went through just returns the stored result
    if attempt["status"] == "completed" and attempt.get("result"):
        return attempt["result"]

    if attempt["status"] != "in_progress":
        raise HTTPException(
            status_code=409,
            detail={"code": "attempt_closed", "message": "This diagnostic is no longer open. Reload the page to start a fresh one."}
        )

    allowed = set(attempt["question_ids"])
    merged = {**(attempt.get("answers") or {}), **clean_answers(submission.answers, allowed)}

    remaining = len(allowed) - len(merged)
    if remaining > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Please answer all questions first ({remaining} left)."
        )

    questions_by_id = load_attempt_questions(attempt)
    if len(questions_by_id) != len(allowed):
        abandon_attempt(attempt["id"])
        raise HTTPException(
            status_code=409,
            detail={"code": "attempt_invalid", "message": "The question set changed. Reload the page to start a fresh diagnostic."}
        )

    subject = attempt["subject"]
    questions = list(questions_by_id.values())

    correct = sum(
        1 for q in questions if merged.get(q["id"]) == q["correct_answer"]
    )
    score = (correct / len(questions)) * 100
    aptitude_tier = calculate_aptitude_tier(score)
    topic_breakdown = calculate_topic_breakdown(questions, merged)

    # Save the tier for the attempt's subject
    row = ensure_subject_row(user_id, subject)
    supabase.table("user_subjects").update(
        {"aptitude_tier": aptitude_tier}
    ).eq("id", row["id"]).execute()

    # users.aptitude_tier mirrors the ACTIVE subject only
    current = supabase.table("users").select("subject").eq("id", user_id).execute()
    if current.data and current.data[0]["subject"] == subject:
        supabase.table("users").update(
            {"aptitude_tier": aptitude_tier}
        ).eq("id", user_id).execute()

    initial_difficulty = (
        "easy" if aptitude_tier == "beginner"
        else "medium" if aptitude_tier == "intermediate"
        else "hard"
    )

    for topic, accuracy in topic_breakdown.items():
        supabase.table("topic_performance").upsert({
            "user_id": user_id,
            "subject": subject,
            "topic": topic,
            "current_difficulty": initial_difficulty,
            "average_accuracy": accuracy,
            "sessions_count": 0
        }, on_conflict="user_id,subject,topic").execute()

    response = {
        "score": round(score, 1),
        "correct": correct,
        "total": len(questions),
        "aptitude_tier": aptitude_tier,
        "topic_breakdown": topic_breakdown,
        "message": f"You have been classified as {aptitude_tier.upper()}. Your personalised study path will be generated next."
    }

    # Close the attempt last, so a failure above can be safely retried
    supabase.table("diagnostic_attempts").update({
        "status": "completed",
        "answers": merged,
        "result": response,
        "completed_at": now_iso(),
        "updated_at": now_iso(),
    }).eq("id", attempt["id"]).execute()

    return response


@router.get("/status")
def get_diagnostic_status(user_id: str = Depends(get_current_user)):
    user = supabase.table("users").select("aptitude_tier, subject").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]
    tier = user.data[0]["aptitude_tier"]

    if tier:
        return {"status": "completed", "aptitude_tier": tier, "subject": subject}

    open_attempt = find_open_attempt(user_id, subject)
    if open_attempt:
        return {
            "status": "in_progress",
            "subject": subject,
            "answered": len(open_attempt.get("answers") or {}),
            "total": len(open_attempt["question_ids"]),
        }

    return {"status": "not_started", "subject": subject}