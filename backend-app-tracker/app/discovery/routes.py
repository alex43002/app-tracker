from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.common.errors import raise_error
from app.discovery import boards, service
from app.discovery.connectors import SUPPORTED_SOURCES
from app.discovery.schemas import (
    CompanyDirectory,
    IngestRequest,
    IngestResponse,
    ResolveTokenRequest,
    ResolveTokenResponse,
    SupportedSources,
)
from app.preferences import service as preferences_service

router = APIRouter()


@router.get("/sources")
def list_sources(current_user_id: str = Depends(get_current_user)):
    """The ATS sources discovery can ingest from."""
    return success(data=SupportedSources(sources=list(SUPPORTED_SOURCES)).model_dump())


@router.post("/resolve")
def resolve_board(
    payload: ResolveTokenRequest,
    current_user_id: str = Depends(get_current_user),
):
    """Extract the ATS source + board token from a pasted careers URL (FEAT-23)."""
    result = boards.extract_board(payload.url)
    if result is None:
        raise_error(
            code="VALIDATION_ERROR",
            message=(
                "Couldn't find a board token in that URL. Supported boards: "
                "Greenhouse (boards.greenhouse.io/<token>) and "
                "Lever (jobs.lever.co/<token>)."
            ),
            http_status=422,
        )
    source, token = result
    return success(
        data=ResolveTokenResponse(source=source, boardToken=token).model_dump()
    )


@router.get("/companies")
def list_companies(
    q: str | None = Query(None, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user),
):
    """Search a curated directory of popular public boards (FEAT-23)."""
    matches = boards.search_companies(q, limit)
    return success(data=CompanyDirectory(companies=matches).model_dump())


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
    collapse: bool = Query(True),
    q: str | None = Query(None),
    company: str | None = Query(None),
    location: str | None = Query(None),
    employmentType: str | None = Query(None),
    source: str | None = Query(None),
    salaryMin: int | None = Query(None, ge=0),
    experienceLevel: str | None = Query(None),
    requiresDegree: bool | None = Query(None),
    sponsorshipAvailable: bool | None = Query(None),
    clearanceRequired: bool | None = Query(None),
    maxAgeDays: int | None = Query(None, ge=0),
    minQuality: int | None = Query(None, ge=0, le=100),
    applyPreferences: bool = Query(False),
    preferredOnly: bool = Query(False),
    current_user_id: str = Depends(get_current_user),
):
    """Search/filter the normalized, aggregated postings.

    Duplicates across boards/sources are merged into one listing by default
    (``collapse=true``); pass ``collapse=false`` for the raw per-posting rows.
    With ``applyPreferences=true`` the caller's hidden companies / job types are
    excluded (and ``preferredOnly=true`` restricts to their preferred employers).
    """
    db = get_db()

    preferred = hidden = hidden_types = None
    if applyPreferences or preferredOnly:
        prefs = preferences_service.get_preferences(db, current_user_id)
        preferred = prefs["preferredCompanies"]
        hidden = prefs["hiddenCompanies"]
        hidden_types = prefs["hiddenEmploymentTypes"]

    result = service.list_jobs(
        db,
        page=page,
        page_size=pageSize,
        sort_by=sortBy,
        sort_order=sortOrder,
        collapse=collapse,
        q=q,
        company=company,
        location=location,
        employment_type=employmentType,
        source=source,
        salary_min=salaryMin,
        experience_level=experienceLevel,
        requires_degree=requiresDegree,
        sponsorship_available=sponsorshipAvailable,
        clearance_required=clearanceRequired,
        max_age_days=maxAgeDays,
        min_quality=minQuality,
        preferred_companies=preferred,
        hidden_companies=hidden,
        hidden_employment_types=hidden_types,
        preferred_only=preferredOnly,
    )
    return success(data=result)
