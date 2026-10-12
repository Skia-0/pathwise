from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from models.schemas import SummariserRequest
from db.supabase_client import supabase
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter()


def build_prompt(text: str, subject: str) -> str:
    return f"""You are a WAEC examination preparation assistant for Ghanaian Senior High School students.

A student has provided the following study material for {subject.upper()}:

---
{text}
---

Please analyse this content and produce a structured WAEC study guide with the following sections:

1. KEY CONCEPTS
List the most important concepts covered in this material that are likely to appear in WAEC examinations.

2. IMPORTANT DEFINITIONS
Extract and clearly define any key terms or vocabulary from the material.

3. IMPORTANT FORMULAS OR RULES
List any formulas, equations, or rules mentioned (especially relevant for Mathematics and Physics).

4. WAEC EXAMINATION FOCUS AREAS
Based on this content, identify which areas are most likely to be tested in WAEC objective and essay questions.

5. LIKELY EXAM QUESTIONS
Generate 3 practice questions based on this material in the style of WAEC past paper questions. Include the question type (objective or essay).

Keep the language clear and accessible for SHS students. Focus only on what is examinable in WAEC."""


@router.post("/summarise")
def summarise_notes(
    request: SummariserRequest,
    user_id: str = Depends(get_current_user)
):
    if len(request.text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Text is too short. Please provide at least 50 characters of study material."
        )

    if len(request.text) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Text is too long. Please limit input to 10,000 characters."
        )

    try:
        prompt = build_prompt(request.text, request.subject)
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )
        summary = response.text

    except Exception as e:
        error_msg = str(e)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            raise HTTPException(
                status_code=503,
                detail="The AI model is temporarily unavailable due to high demand. Please try again in a few minutes."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Summarisation failed: {error_msg}"
        )

    # Save to summary history
    supabase.table("summary_history").insert({
        "user_id": user_id,
        "original_text": request.text[:500],
        "summary": summary
    }).execute()

    return {
        "subject": request.subject,
        "summary": summary,
        "disclaimer": "This summary is AI-generated from your notes. Always verify key facts against your textbook or teacher before the examination."
    }


@router.get("/history")
def get_summary_history(user_id: str = Depends(get_current_user)):
    history = supabase.table("summary_history").select(
        "id, original_text, summary, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()

    return {
        "history": history.data,
        "total": len(history.data)
    }