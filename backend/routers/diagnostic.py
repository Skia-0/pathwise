from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def diagnostic_root():
    return {"message": "Diagnostic router working"}