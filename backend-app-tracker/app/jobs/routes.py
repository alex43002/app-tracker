from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.jobs.schemas import (
    CreateJobRequest,
    UpdateJobRequest,
    CreateJobResponse,
)
from app.jobs import service

router = APIRouter()


@router.post("/")
def create_job(
    payload: CreateJobRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.create_job(db.jobs, payload, current_user_id)
    return success(data=result)


@router.get("/")
def get_jobs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    sortBy: str = Query("createdAt"),
    sortOrder: str = Query("asc"),
    filters: str | None = Query(None),
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.list_jobs(
        db.jobs,
        current_user_id,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder,
        filters=filters,
    )
    return success(data=result)


@router.put("/{id}")
def update_job(
    id: str,
    payload: UpdateJobRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_job(db.jobs, id, current_user_id, payload)
    return success(data=result)


@router.delete("/{id}")
def delete_job(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_job(db.jobs, id, current_user_id)
    return success(data=None)
