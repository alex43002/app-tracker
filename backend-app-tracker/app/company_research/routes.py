from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.company_research import service
from app.company_research.schemas import CompanyList, CompanySnapshot

router = APIRouter()


@router.get("/companies")
def list_companies(
    q: str | None = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    current_user_id: str = Depends(get_current_user),
):
    """Companies present in discovered postings, with open-role counts."""
    db = get_db()
    result = service.list_companies(db, q=q, limit=limit)
    return success(data=CompanyList(**result).model_dump())


@router.get("/snapshot")
def get_snapshot(
    company: str = Query(min_length=1, max_length=200),
    current_user_id: str = Depends(get_current_user),
):
    """A research snapshot for a company, derived from its public postings."""
    db = get_db()
    result = service.snapshot(db, company)
    return success(data=CompanySnapshot(**result).model_dump())
