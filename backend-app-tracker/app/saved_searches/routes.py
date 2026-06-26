from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.saved_searches import service
from app.saved_searches.schemas import (
    CreateSavedSearchRequest,
    SavedSearch,
    SavedSearchList,
    UpdateSavedSearchRequest,
)

router = APIRouter()


@router.post("/")
def create_saved_search(
    payload: CreateSavedSearchRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.create_saved_search(db.saved_searches, payload, current_user_id)
    return success(data=SavedSearch(**result).model_dump())


@router.get("/")
def list_saved_searches(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.list_saved_searches(db.saved_searches, current_user_id)
    return success(data=SavedSearchList(**result).model_dump())


@router.put("/{id}")
def update_saved_search(
    id: str,
    payload: UpdateSavedSearchRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_saved_search(
        db.saved_searches, id, current_user_id, payload
    )
    return success(data=SavedSearch(**result).model_dump())


@router.delete("/{id}")
def delete_saved_search(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_saved_search(db.saved_searches, id, current_user_id)
    return success(data=None)
