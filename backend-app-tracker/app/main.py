from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.users.routes import router as users_router
from app.jobs.routes import router as jobs_router
from app.alerts.routes import router as alerts_router
from app.resumes.routes import router as resumes_router

app = FastAPI(
    title="Job Tracker API",
    version="v1",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS (locked to desktop app use; can be tightened later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten when Electron origin is fixed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Health check (non-authenticated)
@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }

# API Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(resumes_router, prefix="/api/resumes", tags=["Resumes"])