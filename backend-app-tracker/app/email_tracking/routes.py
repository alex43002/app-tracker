from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.email_tracking import service
from app.email_tracking.schemas import ClassifyEmailRequest, EmailClassification

router = APIRouter()


@router.post("/classify")
def classify(
    payload: ClassifyEmailRequest,
    current_user_id: str = Depends(get_current_user),
):
    """Classify a recruiting email (confirmation/interview/rejection/offer/
    recruiter) and match it to the user's tracked jobs, so a status update can
    be suggested. Deterministic heuristics — no generative AI."""
    db = get_db()
    result = service.analyze(db, current_user_id, payload.text, payload.subject)
    return success(data=EmailClassification(**result).model_dump())
