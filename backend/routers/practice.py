from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from models.schemas import SessionSubmission
from db.supabase_client import supabase
import random

router = APIRouter()

ADVANCE_THRESHOLD = 75.0
REMEDIATE_THRESHOLD = 45.0
DIFFICULTY_LEVELS = ["easy", "medium", "hard"]


def get_next_difficulty(current: str, direction: str) -> str:
    idx = DIFFICULTY_LEVELS.index(current)
    if direction == "up":
        return DIFFICULTY_LEVELS[min(idx + 1, len(DIFFICULTY_LEVELS) - 1)]
    else:
        return DIFFICULTY_LEVELS[max(idx - 1, 0)]


def update_adaptive_logic(
    user_id: str,
    subject: str,
    topic: str,
    accuracy: float
):
    # Get current topic performance
    perf = supabase.table("topic_performance").select("*").eq(
        "user_id", user_id
    ).eq("subject", subject).eq("topic", topic).execute()

    if not perf.data:
        # Create initial record if not exists
        supabase.table("topic_performance").insert({
            "user_id": user_id,
            "subject": subject,
            "topic": topic,
            "current_difficulty": "easy",
            "consecutive_above_threshold": 0,
            "consecutive_below_threshold": 0,
            "average_accuracy": accuracy,
            "sessions_count": 1
        }).execute()
        return {"action": "initialized", "message": "Topic performance record created"}

    current = perf.data[0]
    current_difficulty = current["current_difficulty"]
    above_count = current["consecutive_above_threshold"]
    below_count = current["consecutive_below_threshold"]
    sessions = current["sessions_count"]

    # Update running average accuracy
    new_average = ((current["average_accuracy"] * sessions) + accuracy) / (sessions + 1)

    # Apply adaptive logic
    action = "continue"
    message = "Keep going — steady progress"

    if accuracy >= ADVANCE_THRESHOLD:
        above_count += 1
        below_count = 0
        if above_count >= 2:
            # Advance difficulty
            new_difficulty = get_next_difficulty(current_difficulty, "up")
            action = "advanced"
            message = f"Great work! Moving to {new_difficulty} questions"
            above_count = 0
        else:
            new_difficulty = current_difficulty
            message = "Good session! One more strong session to advance"
    elif accuracy < REMEDIATE_THRESHOLD:
        below_count += 1
        above_count = 0
        if below_count >= 2:
            # Drop difficulty
            new_difficulty = get_next_difficulty(current_difficulty, "down")
            action = "remediated"
            message = f"Let's revisit this topic with easier questions first"
            below_count = 0
        else:
            new_difficulty = current_difficulty
            message = "Keep practising — one more session before we adjust"
    else:
        # Between thresholds — maintain
        above_count = 0
        below_count = 0
        new_difficulty = current_difficulty
        message = "Solid session — keep building consistency"

    # Update topic performance
    supabase.table("topic_performance").update({
        "current_difficulty": new_difficulty,
        "consecutive_above_threshold": above_count,
        "consecutive_below_threshold": below_count,
        "average_accuracy": round(new_average, 2),
        "sessions_count": sessions + 1
    }).eq("user_id", user_id).eq("subject", subject).eq("topic", topic).execute()

    return {
        "action": action,
        "message": message,
        "previous_difficulty": current_difficulty,
        "new_difficulty": new_difficulty,
        "accuracy": round(accuracy, 1)
    }


@router.get("/questions/{topic}")
def get_practice_questions(
    topic: str,
    user_id: str = Depends(get_current_user)
):
    # Get user subject
    user = supabase.table("users").select("subject").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]

    # Get current difficulty for this topic
    perf = supabase.table("topic_performance").select(
        "current_difficulty"
    ).eq("user_id", user_id).eq("subject", subject).eq("topic", topic).execute()

    difficulty = perf.data[0]["current_difficulty"] if perf.data else "easy"

    # Fetch questions for this topic and difficulty
    questions = supabase.table("questions").select("*").eq(
        "subject", subject
    ).eq("topic", topic).eq("difficulty", difficulty).execute()

    if not questions.data:
        # Fallback to any difficulty if none found at current level
        questions = supabase.table("questions").select("*").eq(
            "subject", subject
        ).eq("topic", topic).execute()

    if not questions.data:
        raise HTTPException(
            status_code=404,
            detail=f"No questions found for topic: {topic}"
        )

    # Sample up to 10 questions
    selected = random.sample(questions.data, min(10, len(questions.data)))

    # Strip correct answers
    for q in selected:
        q.pop("correct_answer", None)

    return {
        "topic": topic,
        "difficulty": difficulty,
        "questions": selected,
        "total": len(selected)
    }


@router.post("/submit-session")
def submit_practice_session(
    submission: SessionSubmission,
    user_id: str = Depends(get_current_user)
):
    # Get user subject
    user = supabase.table("users").select("subject").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]
    topic = submission.topic

    # Fetch questions with correct answers
    question_ids = list(submission.answers.keys())
    questions = supabase.table("questions").select("*").in_(
        "id", question_ids
    ).execute()

    if not questions.data:
        raise HTTPException(status_code=400, detail="No valid questions found")

    # Score the session
    correct = 0
    results = []
    for q in questions.data:
        user_answer = submission.answers.get(q["id"])
        is_correct = user_answer == q["correct_answer"]
        if is_correct:
            correct += 1
        results.append({
            "question_id": q["id"],
            "question_text": q["question_text"],
            "user_answer": user_answer,
            "correct_answer": q["correct_answer"],
            "is_correct": is_correct
        })

    total = len(questions.data)
    accuracy = (correct / total) * 100

    # Save session to database
    supabase.table("sessions").insert({
        "user_id": user_id,
        "subject": subject,
        "topic": topic,
        "questions_attempted": total,
        "correct_answers": correct,
        "accuracy": round(accuracy, 2)
    }).execute()

    # Run adaptive logic
    adaptive_result = update_adaptive_logic(user_id, subject, topic, accuracy)

    return {
        "topic": topic,
        "score": {
            "correct": correct,
            "total": total,
            "accuracy": round(accuracy, 1)
        },
        "results": results,
        "adaptive_feedback": adaptive_result
    }


@router.get("/progress")
def get_progress(user_id: str = Depends(get_current_user)):
    user = supabase.table("users").select("subject, aptitude_tier").eq(
        "id", user_id
    ).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]

    # Get all topic performance
    topic_perf = supabase.table("topic_performance").select("*").eq(
        "user_id", user_id
    ).eq("subject", subject).execute()

    # Get session history
    sessions = supabase.table("sessions").select("*").eq(
        "user_id", user_id
    ).eq("subject", subject).order("created_at", desc=True).limit(10).execute()

    # Calculate exam readiness
    if topic_perf.data:
        avg_accuracy = sum(t["average_accuracy"] for t in topic_perf.data) / len(topic_perf.data)
        topics_above_threshold = sum(
            1 for t in topic_perf.data if t["average_accuracy"] >= ADVANCE_THRESHOLD
        )
        readiness = round((topics_above_threshold / len(topic_perf.data)) * 100, 1)
    else:
        avg_accuracy = 0
        readiness = 0

    return {
        "aptitude_tier": user.data[0]["aptitude_tier"],
        "subject": subject,
        "topic_performance": topic_perf.data,
        "recent_sessions": sessions.data,
        "summary": {
            "average_accuracy": round(avg_accuracy, 1),
            "exam_readiness_percentage": readiness,
            "total_sessions": len(sessions.data)
        }
    }