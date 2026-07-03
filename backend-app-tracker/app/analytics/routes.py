from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.analytics import service
from app.analytics.schemas import (
    AnalyticsSummary,
    ApplicationsOverTime,
    CompanyFunnels,
    Funnel,
    JobStatusCounts,
    SourcePerformance,
    TimeToOffer,
)

router = APIRouter()


@router.get("/status-counts")
def get_job_status_counts(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.get_job_status_counts(db.jobs, current_user_id)
    return success(data=JobStatusCounts(**result).model_dump())


@router.get("/funnel")
def get_funnel(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.get_funnel(db.jobs, current_user_id)
    return success(data=Funnel(**result).model_dump())


@router.get("/applications-over-time")
def get_applications_over_time(
    interval: str = Query(service.DEFAULT_INTERVAL),
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.get_applications_over_time(db.jobs, current_user_id, interval)
    return success(data=ApplicationsOverTime(**result).model_dump())


@router.get("/time-to-offer")
def get_time_to_offer(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.get_time_to_offer(db.jobs, current_user_id)
    return success(data=TimeToOffer(**result).model_dump())


@router.get("/by-company")
def get_company_funnels(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.get_company_funnels(db.jobs, current_user_id)
    return success(data=CompanyFunnels(**result).model_dump())


@router.get("/source-performance")
def get_source_performance(current_user_id: str = Depends(get_current_user)):
    """Per-source funnel + conversion rates: which job boards, recruiters, and
    referral channels produce the best results."""
    db = get_db()
    result = service.get_source_performance(db.jobs, current_user_id)
    return success(data=SourcePerformance(**result).model_dump())


@router.get("/summary")
def get_summary(
    interval: str = Query(service.DEFAULT_INTERVAL),
    current_user_id: str = Depends(get_current_user),
):
    """All headline analytics (funnel, over-time, time-to-offer, by-company) in
    one response computed from a single per-user fetch (CLN-13)."""
    db = get_db()
    result = service.get_summary(db.jobs, current_user_id, interval)
    return success(data=AnalyticsSummary(**result).model_dump())