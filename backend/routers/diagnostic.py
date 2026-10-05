from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from models.schemas import DiagnosticSubmission
from db.supabase_client import supabase
import random

router = APIRouter()


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


@router.get("/questions")
def get_diagnostic_questions(user_id: str = Depends(get_current_user)):
    # Get user subject
    user = supabase.table("users").select("subject").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]

    # Fetch questions by difficulty
    easy = supabase.table("questions").select("*").eq("subject", subject).eq("difficulty", "easy").execute().data
    medium = supabase.table("questions").select("*").eq("subject", subject).eq("difficulty", "medium").execute().data
    hard = supabase.table("questions").select("*").eq("subject", subject).eq("difficulty", "hard").execute().data

    # Sample 6 easy, 8 medium, 6 hard
    selected = (
        random.sample(easy, min(6, len(easy))) +
        random.sample(medium, min(8, len(medium))) +
        random.sample(hard, min(6, len(hard)))
    )
    random.shuffle(selected)

    # Strip correct answers before sending to frontend
    for q in selected:
        q.pop("correct_answer", None)

    return {"questions": selected, "total": len(selected)}


@router.post("/submit")
def submit_diagnostic(
    submission: DiagnosticSubmission,
    user_id: str = Depends(get_current_user)
):
    # Check if user already has an aptitude tier
    user = supabase.table("users").select("subject, aptitude_tier").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    subject = user.data[0]["subject"]

    # Fetch the actual questions with correct answers
    question_ids = list(submission.answers.keys())
    questions = supabase.table("questions").select("*").in_("id", question_ids).execute().data

    if not questions:
        raise HTTPException(status_code=400, detail="No valid questions found")

    # Calculate score
    correct = 0
    for q in questions:
        if submission.answers.get(q["id"]) == q["correct_answer"]:
            correct += 1

    score = (correct / len(questions)) * 100
    aptitude_tier = calculate_aptitude_tier(score)
    topic_breakdown = calculate_topic_breakdown(questions, submission.answers)

    # Update user aptitude tier in database
    supabase.table("users").update({"aptitude_tier": aptitude_tier}).eq("id", user_id).execute()

    # Set initial difficulty in topic_performance for each topic
    initial_difficulty = "easy" if aptitude_tier == "beginner" else "medium" if aptitude_tier == "intermediate" else "hard"

    for topic, accuracy in topic_breakdown.items():
        supabase.table("topic_performance").upsert({
            "user_id": user_id,
            "subject": subject,
            "topic": topic,
            "current_difficulty": initial_difficulty,
            "average_accuracy": accuracy,
            "sessions_count": 0
        }).execute()

    return {
        "score": round(score, 1),
        "correct": correct,
        "total": len(questions),
        "aptitude_tier": aptitude_tier,
        "topic_breakdown": topic_breakdown,
        "message": f"You have been classified as {aptitude_tier.upper()}. Your personalised study path will be generated next."
    }


@router.get("/status")
def get_diagnostic_status(user_id: str = Depends(get_current_user)):
    user = supabase.table("users").select("aptitude_tier, subject").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    has_completed = user.data[0]["aptitude_tier"] is not None
    return {
        "has_completed_diagnostic": has_completed,
        "aptitude_tier": user.data[0]["aptitude_tier"],
        "subject": user.data[0]["subject"]
    }