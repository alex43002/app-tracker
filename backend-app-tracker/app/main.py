from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import get_db, ensure_indexes
from app.common.responses import failure
from app.common.ratelimit import limiter
from app.alerts import runner as alert_runner

from app.auth.routes import router as auth_router
from app.users.routes import router as users_router
from app.jobs.routes import router as jobs_router
from app.alerts.routes import router as alerts_router
from app.resumes.routes import router as resumes_router
from app.analytics.routes import router as analytics_router
from app.saved_searches.routes import router as saved_searches_router
from app.matching.routes import router as matching_router
from app.discovery.routes import router as discovery_router
from app.preferences.routes import router as preferences_router
from app.job_alerts.routes import router as job_alerts_router
from app.offers.routes import router as offers_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure the documented indexes exist before serving traffic.
    ensure_indexes(get_db())
    alert_runner.start(app)
    try:
        yield
    finally:
        await alert_runner.stop(app)


app = FastAPI(
    title="Job Tracker API",
    version="v1",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting (SEC-3) — the limiter is attached to app state; endpoints opt in
# via @limiter.limit(...).
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content=failure(
            code="RATE_LIMITED",
            message="Too many requests — please try again later",
        ),
    )


# CORS — restricted to the configured desktop/dev origins (see Settings).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def _field_errors(exc) -> list[dict]:
    """Reduce a (Request)ValidationError to a JSON-safe field/message list."""
    out = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body",)]
        out.append({"field": ".".join(loc), "message": err.get("msg", "Invalid value")})
    return out


def _validation_response(exc) -> JSONResponse:
    envelope = failure(code="VALIDATION_ERROR", message="Request validation failed")
    envelope["error"]["details"] = _field_errors(exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope,
    )


_STATUS_CODE_TO_ERROR = {
    401: "AUTH_REQUIRED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
}


# Standardize every HTTPException onto the bare error envelope. Handlers that
# already raise an envelope (via raise_error / auth) pass it straight through;
# framework-raised exceptions (e.g. missing bearer token) get wrapped.
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "success" in detail:
        content = detail
    else:
        content = failure(
            code=_STATUS_CODE_TO_ERROR.get(exc.status_code, "HTTP_ERROR"),
            message=str(detail),
        )
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=getattr(exc, "headers", None),
    )


# Normalize validation failures into the standard error envelope so the desktop
# client can surface them uniformly (instead of FastAPI's default 422 shape).
@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError):
    return _validation_response(exc)


@app.exception_handler(ValidationError)
async def pydantic_validation_handler(request: Request, exc: ValidationError):
    return _validation_response(exc)


# Health check (non-authenticated)
@app.get("/health")
def health_check():
    return {"status": "ok"}


# API Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(resumes_router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(
    saved_searches_router, prefix="/api/saved-searches", tags=["Saved Searches"]
)
app.include_router(matching_router, prefix="/api/match", tags=["Matching"])
app.include_router(discovery_router, prefix="/api/discovery", tags=["Discovery"])
app.include_router(preferences_router, prefix="/api/preferences", tags=["Preferences"])
app.include_router(job_alerts_router, prefix="/api/job-alerts", tags=["Job Alerts"])
app.include_router(offers_router, prefix="/api/offers", tags=["Offers"])
