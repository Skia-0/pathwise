from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_current_user
from models.schemas import SummariserRequest
from db.supabase_client import supabase
from google import genai
import os
import time
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

router = APIRouter()

SUBJECT_LABELS = {
    "mathematics": "Core Mathematics",
    "physics": "Elective Physics",
}


def build_prompt(text: str, subject: str) -> str:
    label = SUBJECT_LABELS[subject]
    return f"""You are a WAEC examination preparation assistant for Ghanaian Senior High School students.

The student selected the subject: {label}.

STEP 1 - SUBJECT CHECK
Read the study material below. If it is NOT mainly about {label}, reply with ONE line only, in exactly this format, and nothing else:
SUBJECT_MISMATCH: mathematics
SUBJECT_MISMATCH: physics
SUBJECT_MISMATCH: other
Choose the line that matches the material (use "other" if it is neither Mathematics nor Physics).
If the material IS mainly about {label}, go to Step 2 and never mention this check.

STEP 2 - WAEC STUDY GUIDE
Write a study guide using ONLY the material below as your source of facts. Do not add facts that are not supported by the material. If something in the material looks wrong, say so in a short "Check this" note.

Use these sections as Markdown "##" headings, in this order:
## Key Concepts
## Important Definitions
## Formulas and Rules
## WAEC Focus Areas
## Practice Questions
Under Practice Questions, write 3 WAEC-style questions based on the material, each followed by its answer and a brief working.

Formatting rules:
- Start directly with the first heading. No introduction and no closing remarks.
- Use "-" for bullet points and **bold** for key terms.
- Write all mathematics in LaTeX: $...$ for inline and $$...$$ for display equations.
- Keep the language clear for Senior High School students.

STUDENT MATERIAL:
---
{text}
---"""


def generate_with_retry(prompt: str, attempts: int = 3) -> str:
    delay = 2
    for attempt in range(attempts):
        try:
            response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
            if not response.text:
                raise HTTPException(
                    status_code=502,
                    detail="The AI returned an empty response. Please try again."
                )
            return response.text
        except HTTPException:
            raise
        except Exception as e:
            message = str(e)
            busy = "503" in message or "UNAVAILABLE" in message
            if busy and attempt < attempts - 1:
                time.sleep(delay)
                delay *= 2
                continue
            if busy:
                raise HTTPException(
                    status_code=503,
                    detail="The AI model is busy right now. Please try again in a minute."
                )
            raise HTTPException(status_code=500, detail=f"Summarisation failed: {message}")
    raise HTTPException(status_code=503, detail="The AI model is busy right now.")


@router.post("/summarise")
def summarise_notes(
    request: SummariserRequest,
    user_id: str = Depends(get_current_user)
):
    if request.subject not in SUBJECT_LABELS:
        raise HTTPException(status_code=400, detail="Subject must be mathematics or physics")

    text = request.text.strip()
    if len(text) < 50:
        raise HTTPException(
            status_code=400,
            detail="Text is too short. Please provide at least 50 characters of study material."
        )
    if len(text) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Text is too long. Please limit input to 10,000 characters."
        )

    output = generate_with_retry(build_prompt(text, request.subject)).strip()

    # The model flags material that does not match the selected subject
    head = output[:60]
    if "SUBJECT_MISMATCH" in head.upper():
        lowered = head.lower()
        detected = "other"
        if "physics" in lowered:
            detected = "physics"
        elif "mathematics" in lowered or "maths" in lowered:
            detected = "mathematics"
        if detected == request.subject:
            detected = "other"

        if detected == "other":
            message = "This doesn't look like Mathematics or Physics study material, so it can't be summarised here."
        else:
            message = (
                f"This looks like {SUBJECT_LABELS[detected]} material, "
                f"but you selected {SUBJECT_LABELS[request.subject]}."
            )
        raise HTTPException(
            status_code=422,
            detail={"code": "subject_mismatch", "detected_subject": detected, "message": message}
        )

    supabase.table("summary_history").insert({
        "user_id": user_id,
        "original_text": text[:500],
        "summary": output
    }).execute()

    return {
        "subject": request.subject,
        "summary": output,
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