import re
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


# ── Auth schemas ──────────────────────────────────────────
class UserRegister(BaseModel):
    email: str
    full_name: str
    password: str
    subject: str  # 'mathematics' or 'physics'

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, value: str) -> str:
        missing = []
        if len(value) < 8:
            missing.append("at least 8 characters")
        if not re.search(r"[A-Z]", value):
            missing.append("one uppercase letter")
        if not re.search(r"\d", value):
            missing.append("one number")
        if not re.search(r"[^A-Za-z0-9]", value):
            missing.append("one special character")
        if missing:
            raise ValueError("Password needs " + ", ".join(missing) + ".")
        return value


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ── Diagnostic schemas ────────────────────────────────────
class DiagnosticSubmission(BaseModel):
    attempt_id: str
    answers: dict  # {question_id: 'A'/'B'/'C'/'D'}


class DiagnosticProgress(BaseModel):
    attempt_id: str
    answers: dict
    current_index: int = 0


class DiagnosticResult(BaseModel):
    score: float
    aptitude_tier: str
    topic_breakdown: dict


# ── Study path schemas ────────────────────────────────────
class StudyPathCreate(BaseModel):
    exam_date: date
    daily_hours: float


# ── Practice schemas ──────────────────────────────────────
class SessionSubmission(BaseModel):
    topic: str
    answers: dict  # {question_id: 'A'/'B'/'C'/'D'}


# ── Summariser schemas ────────────────────────────────────
class SummariserRequest(BaseModel):
    text: str
    subject: str

# ── Subject schemas ───────────────────────────────────────
class SubjectRequest(BaseModel):
    subject: str