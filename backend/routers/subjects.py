from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from models.schemas import SubjectRequest
from db.supabase_client import supabase

router = APIRouter()

VALID_SUBJECTS = ["mathematics", "physics"]


def get_user(user_id: str) -> dict:
    result = supabase.table("users").select(
        "id, email, full_name, subject, aptitude_tier"
    ).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


def ensure_subject_row(user_id: str, subject: str, aptitude_tier=None) -> dict:
    """Make sure the user has a user_subjects row for this subject."""
    existing = supabase.table("user_subjects").select("id, subject, aptitude_tier").eq(
        "user_id", user_id
    ).eq("subject", subject).execute()

    if existing.data:
        row = existing.data[0]
        if aptitude_tier and not row.get("aptitude_tier"):
            supabase.table("user_subjects").update(
                {"aptitude_tier": aptitude_tier}
            ).eq("id", row["id"]).execute()
            row["aptitude_tier"] = aptitude_tier
        return row

    new_row = {"user_id": user_id, "subject": subject}
    if aptitude_tier:
        new_row["aptitude_tier"] = aptitude_tier
    created = supabase.table("user_subjects").insert(new_row).execute()
    return created.data[0]


@router.get("/my")
def my_subjects(user_id: str = Depends(get_current_user)):
    user = get_user(user_id)
    ensure_subject_row(user_id, user["subject"], user["aptitude_tier"])

    rows = supabase.table("user_subjects").select("subject, aptitude_tier").eq(
        "user_id", user_id
    ).execute().data

    owned = [r["subject"] for r in rows]
    return {
        "active_subject": user["subject"],
        "subjects": rows,
        "available_to_add": [s for s in VALID_SUBJECTS if s not in owned],
    }


@router.post("/add")
def add_subject(body: SubjectRequest, user_id: str = Depends(get_current_user)):
    if body.subject not in VALID_SUBJECTS:
        raise HTTPException(status_code=400, detail="Subject must be mathematics or physics")

    user = get_user(user_id)
    ensure_subject_row(user_id, user["subject"], user["aptitude_tier"])

    existing = supabase.table("user_subjects").select("id").eq(
        "user_id", user_id
    ).eq("subject", body.subject).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already added this subject")

    supabase.table("user_subjects").insert(
        {"user_id": user_id, "subject": body.subject}
    ).execute()

    # The new subject becomes active; it has no diagnostic result yet
    supabase.table("users").update(
        {"subject": body.subject, "aptitude_tier": None}
    ).eq("id", user_id).execute()

    return {
        "message": f"{body.subject.capitalize()} added. Complete its diagnostic to begin.",
        "user": get_user(user_id),
    }


@router.post("/switch")
def switch_subject(body: SubjectRequest, user_id: str = Depends(get_current_user)):
    if body.subject not in VALID_SUBJECTS:
        raise HTTPException(status_code=400, detail="Subject must be mathematics or physics")

    row = supabase.table("user_subjects").select("aptitude_tier").eq(
        "user_id", user_id
    ).eq("subject", body.subject).execute()
    if not row.data:
        raise HTTPException(status_code=400, detail="Add this subject first")

    supabase.table("users").update(
        {"subject": body.subject, "aptitude_tier": row.data[0]["aptitude_tier"]}
    ).eq("id", user_id).execute()

    return {"message": "Subject switched", "user": get_user(user_id)}