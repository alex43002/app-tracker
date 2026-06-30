from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.preferences import service
from app.preferences.schemas import Preferences, UpdatePreferencesRequest

router = APIRouter()


@router.get("/")
def get_preferences(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.get_preferences(db, current_user_id)
    return success(data=Preferences(**result).model_dump())


@router.put("/")
def update_preferences(
    payload: UpdatePreferencesRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_preferences(db, current_user_id, payload)
    return success(data=Preferences(**result).model_dump())
