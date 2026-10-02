from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, diagnostic, studypath, practice, summariser

app = FastAPI(title="PathWise API", version="1.0.0")

# Allow React frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(diagnostic.router, prefix="/diagnostic", tags=["Diagnostic"])
app.include_router(studypath.router, prefix="/studypath", tags=["Study Path"])
app.include_router(practice.router, prefix="/practice", tags=["Practice"])
app.include_router(summariser.router, prefix="/summariser", tags=["Summariser"])

@app.get("/")
def root():
    return {"message": "PathWise API is running"}