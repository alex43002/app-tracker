from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.analytics import service

router = APIRouter()


@router.get("/status-counts")
def get_job_status_counts(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.get_job_status_counts(db.jobs, current_user_id)
    return success(data=result)