from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from models.schemas import StudyPathCreate
from db.supabase_client import supabase
from datetime import date, timedelta
import math

router = APIRouter()

# WAEC Mathematics topics in pedagogical order
MATHEMATICS_TOPICS = [
    "Number and Numeration",
    "Fractions and Decimals",
    "Algebraic Expressions",
    "Linear Equations",
    "Sets",
    "Simultaneous Equations",
    "Quadratic Equations",
    "Indices and Logarithms",
    "Mensuration",
    "Plane Geometry",
    "Geometry",
    "Trigonometry",
    "Statistics",
    "Probability",
    "Vectors",
    "Calculus"
]

# WAEC Physics topics in pedagogical order
PHYSICS_TOPICS = [
    "Measurements and Units",
    "Scalars and Vectors",
    "Motion",
    "Forces",
    "Work, Energy and Power",
    "Pressure",
    "Waves",
    "Sound",
    "Light",
    "Heat and Temperature",
    "Electricity",
    "Magnetism",
    "Atomic and Nuclear Physics",
    "Electronics",
    "Energy and Society"
]


def get_topic_list(subject: str) -> list:
    if subject == "mathematics":
        return MATHEMATICS_TOPICS
    return PHYSICS_TOPICS


def generate_milestones(
    topics: list,
    topic_breakdown: dict,
    exam_date: date,
    daily_hours: float,
    aptitude_tier: str
) -> list:
    today = date.today()
    days_available = (exam_date - today).days

    if days_available <= 0:
        raise HTTPException(status_code=400, detail="Exam date must be in the future")

    total_hours = days_available * daily_hours

    # Assign weight to each topic based on diagnostic weakness
    # Weaker topics get more time
    topic_weights = {}
    for topic in topics:
        accuracy = topic_breakdown.get(topic, 50)  # default 50% if not in diagnostic
        # Lower accuracy = higher weight = more time
        weight = max(100 - accuracy, 20)
        topic_weights[topic] = weight

    total_weight = sum(topic_weights.values())

    # Calculate hours per topic proportionally
    topic_hours = {}
    for topic, weight in topic_weights.items():
        hours = (weight / total_weight) * total_hours
        topic_hours[topic] = max(hours, 1)  # minimum 1 hour per topic

    # Generate milestone dates
    milestones = []
    current_date = today
    hours_per_day = daily_hours

    for i, topic in enumerate(topics):
        hours_needed = topic_hours[topic]
        days_needed = math.ceil(hours_needed / hours_per_day)
        target_date = current_date + timedelta(days=days_needed)

        # Don't exceed exam date
        if target_date > exam_date:
            target_date = exam_date

        milestones.append({
            "topic": topic,
            "target_date": target_date.isoformat(),
            "order_index": i + 1,
            "estimated_hours": round(hours_needed, 1)
        })

        current_date = target_date

    return milestones


@router.post("/generate")
def generate_study_path(
    path_data: StudyPathCreate,
    user_id: str = Depends(get_current_user)
):
    # Get user details
    user = supabase.table("users").select("subject, aptitude_tier").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user.data[0]

    if not user_data["aptitude_tier"]:
        raise HTTPException(
            status_code=400,
            detail="Please complete the diagnostic quiz before generating a study path"
        )

    subject = user_data["subject"]
    aptitude_tier = user_data["aptitude_tier"]

    # Check if study path already exists
    existing = supabase.table("study_paths").select("id").eq("user_id", user_id).execute()
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="Study path already exists. Use /studypath/update to modify it."
        )

    # Get topic performance from diagnostic
    topic_perf = supabase.table("topic_performance").select(
        "topic, average_accuracy"
    ).eq("user_id", user_id).eq("subject", subject).execute()

    topic_breakdown = {}
    if topic_perf.data:
        for row in topic_perf.data:
            topic_breakdown[row["topic"]] = row["average_accuracy"]

    # Generate milestones
    topics = get_topic_list(subject)
    milestones = generate_milestones(
        topics,
        topic_breakdown,
        path_data.exam_date,
        path_data.daily_hours,
        aptitude_tier
    )

    # Save study path
    path_result = supabase.table("study_paths").insert({
        "user_id": user_id,
        "subject": subject,
        "exam_date": path_data.exam_date.isoformat(),
        "daily_hours": path_data.daily_hours
    }).execute()

    if not path_result.data:
        raise HTTPException(status_code=500, detail="Failed to create study path")

    study_path_id = path_result.data[0]["id"]

    # Save milestones
    milestone_rows = []
    for m in milestones:
        milestone_rows.append({
            "study_path_id": study_path_id,
            "topic": m["topic"],
            "target_date": m["target_date"],
            "order_index": m["order_index"],
            "is_completed": False
        })

    supabase.table("milestones").insert(milestone_rows).execute()

    return {
        "message": "Study path generated successfully",
        "study_path_id": study_path_id,
        "subject": subject,
        "aptitude_tier": aptitude_tier,
        "exam_date": path_data.exam_date.isoformat(),
        "daily_hours": path_data.daily_hours,
        "total_topics": len(milestones),
        "milestones": milestones
    }


@router.get("/my-path")
def get_my_study_path(user_id: str = Depends(get_current_user)):
    # Get study path
    path = supabase.table("study_paths").select("*").eq("user_id", user_id).execute()
    if not path.data:
        raise HTTPException(status_code=404, detail="No study path found. Please generate one first.")

    study_path = path.data[0]

    # Get milestones ordered by index
    milestones = supabase.table("milestones").select("*").eq(
        "study_path_id", study_path["id"]
    ).order("order_index").execute()

    completed = sum(1 for m in milestones.data if m["is_completed"])
    total = len(milestones.data)
    progress = round((completed / total) * 100, 1) if total > 0 else 0

    return {
        "study_path": study_path,
        "milestones": milestones.data,
        "progress": {
            "completed": completed,
            "total": total,
            "percentage": progress
        }
    }


@router.patch("/complete-milestone/{milestone_id}")
def complete_milestone(
    milestone_id: str,
    user_id: str = Depends(get_current_user)
):
    result = supabase.table("milestones").update(
        {"is_completed": True}
    ).eq("id", milestone_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Milestone not found")

    return {"message": "Milestone marked as complete", "milestone_id": milestone_id}