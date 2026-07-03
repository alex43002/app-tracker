from fastapi import APIRouter, Depends

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.star_stories import service
from app.star_stories.schemas import (
    CreateStarStoryRequest,
    StarStory,
    StarStoryList,
    UpdateStarStoryRequest,
)

router = APIRouter()


@router.post("/")
def create_story(
    payload: CreateStarStoryRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.create_story(db, payload, current_user_id)
    return success(data=StarStory(**result).model_dump())


@router.get("/")
def list_stories(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    result = service.list_stories(db, current_user_id)
    return success(data=StarStoryList(**result).model_dump())


@router.put("/{id}")
def update_story(
    id: str,
    payload: UpdateStarStoryRequest,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    result = service.update_story(db, id, current_user_id, payload)
    return success(data=StarStory(**result).model_dump())


@router.delete("/{id}")
def delete_story(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    db = get_db()
    service.delete_story(db, id, current_user_id)
    return success(data=None)
