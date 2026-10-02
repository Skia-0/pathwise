from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def summariser_root():
    return {"message": "Summariser router working"}