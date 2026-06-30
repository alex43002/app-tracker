from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.config import settings
from app.job_alerts import service
from app.job_alerts.schemas import (
    CreateJobAlertRequest,
    JobAlert,
    JobAlertCheck,
    JobAlertList,
    UpdateJobAlertRequest,
)
from app.notifications.notifier import build_notifier

router = APIRouter()


@router.post("/")
def create_job_alert(
    payload: CreateJobAlertRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.create_job_alert(db, payload, current_user_id)
    return success(data=JobAlert(**result).model_dump())


@router.get("/")
def list_job_alerts(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.list_job_alerts(db, current_user_id)
    return success(data=JobAlertList(**result).model_dump())


@router.put("/{id}")
def update_job_alert(
    id: str,
    payload: UpdateJobAlertRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_job_alert(db, id, current_user_id, payload)
    return success(data=JobAlert(**result).model_dump())


@router.delete("/{id}")
def delete_job_alert(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_job_alert(db, id, current_user_id)
    return success(data=None)


@router.post("/{id}/check")
def check_job_alert(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    """Re-run a saved search now and (if enabled) notify on new matches."""
    db = get_db()
    notifier = build_notifier(settings)
    result = service.check_alert(db, id, current_user_id, notifier)
    return success(data=JobAlertCheck(**result).model_dump())
