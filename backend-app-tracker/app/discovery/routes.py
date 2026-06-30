from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.discovery import service
from app.discovery.connectors import SUPPORTED_SOURCES
from app.discovery.schemas import IngestRequest, IngestResponse, SupportedSources

router = APIRouter()


@router.get("/sources")
def list_sources(current_user_id: str = Depends(get_current_user)):
    """The ATS sources discovery can ingest from."""
    return success(data=SupportedSources(sources=list(SUPPORTED_SOURCES)).model_dump())


@router.post("/ingest")
def ingest(
    payload: IngestRequest,
    current_user_id: str = Depends(get_current_user),
):
    """Fetch a company's public board and upsert its postings."""
    db = get_db()
    result = service.ingest(
        db, payload.source, payload.boardToken, payload.companyName
    )
    return success(data=IngestResponse(**result).model_dump())


@router.get("/jobs")
def list_jobs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=100),
    sortBy: str = Query("postedAt"),
    sortOrder: str = Query("desc"),
    q: str | None = Query(None),
    company: str | None = Query(None),
    location: str | None = Query(None),
    employmentType: str | None = Query(None),
    source: str | None = Query(None),
    salaryMin: int | None = Query(None, ge=0),
    current_user_id: str = Depends(get_current_user),
):
    """Search/filter the normalized, aggregated postings."""
    db = get_db()
    result = service.list_jobs(
        db,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder,
        q=q,
        company=company,
        location=location,
        employment_type=employmentType,
        source=source,
        salary_min=salaryMin,
    )
    return success(data=result)
