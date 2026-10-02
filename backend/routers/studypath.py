from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def studypath_root():
    return {"message": "Study path router working"}