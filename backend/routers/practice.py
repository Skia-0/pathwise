from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def practice_root():
    return {"message": "Practice router working"}