from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.alerts.schemas import (
    CreateAlertRequest,
    UpdateAlertRequest,
)
from app.alerts import service

router = APIRouter()


@router.post("/")
def create_alert(
    payload: CreateAlertRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.create_alert(db.alerts, payload, current_user_id)
    return success(data=result)


@router.get("/")
def get_alerts(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    sortBy: str = Query("createdAt"),
    sortOrder: str = Query("asc"),
    filters: str | None = Query(None),
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.list_alerts(
        db.alerts,
        current_user_id,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder,
        filters=filters,
    )
    return success(data=result)


@router.put("/{id}")
def update_alert(
    id: str,
    payload: UpdateAlertRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_alert(db.alerts, id, current_user_id, payload)
    return success(data=result)


@router.delete("/{id}")
def delete_alert(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_alert(db.alerts, id, current_user_id)
    return success(data=None)
