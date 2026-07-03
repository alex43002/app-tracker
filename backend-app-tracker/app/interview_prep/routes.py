from fastapi import APIRouter, Depends

from app.common.auth import get_current_user
from app.common.responses import success
from app.interview_prep.generator import generate_prep
from app.interview_prep.schemas import GeneratePrepRequest, PrepResult

router = APIRouter()


@router.post("/generate")
def generate(
    payload: GeneratePrepRequest,
    current_user_id: str = Depends(get_current_user),
):
    """Turn a job description into role-specific prep notes, topics, and
    practice questions (deterministic, no generative AI)."""
    result = generate_prep(payload.jobDescription, payload.jobTitle)
    return success(data=PrepResult(**result).model_dump())
