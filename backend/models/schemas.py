from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date

# ── Auth schemas ──────────────────────────────────────────
class UserRegister(BaseModel):
    email: str
    full_name: str
    password: str
    subject: str  # 'mathematics' or 'physics'

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
    answers: dict  # {question_id: 'A'/'B'/'C'/'D'}

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