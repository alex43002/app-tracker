from fastapi import APIRouter, Depends, File, UploadFile

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.matching import service
from app.matching.schemas import (
    ExtractResumeResponse,
    ScoreRequest,
    ScoreResponse,
    ScrapeJobRequest,
    ScrapeJobResponse,
)

router = APIRouter()


@router.post("/scrape")
def scrape_job(
    payload: ScrapeJobRequest,
    current_user_id: str = Depends(get_current_user),
):
    """Scrape a job-posting URL and return its title + extracted skills/keywords."""
    result = service.scrape_job(str(payload.url))
    return success(data=ScrapeJobResponse(**result).model_dump())


@router.post("/extract-resume")
def extract_resume(
    resume: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user),
):
    """Extract text from an ad-hoc résumé upload so it can be scored.

    The file is not stored — the extracted ``text`` is returned for the client
    to replay as ``resumeText`` when calling ``/score``.
    """
    result = service.extract_resume_upload(resume)
    return success(data=ExtractResumeResponse(**result).model_dump())


@router.post("/score")
def score(
    payload: ScoreRequest,
    current_user_id: str = Depends(get_current_user),
):
    """Score a résumé against a job description (URL or pasted text)."""
    db = get_db()
    result = service.score(db, payload, current_user_id)
    return success(data=ScoreResponse(**result).model_dump())
