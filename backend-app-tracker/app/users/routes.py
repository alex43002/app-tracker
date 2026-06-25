from fastapi import APIRouter, Depends, status

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.common.errors import raise_error
from app.users.schemas import UpdateUserRequest
from app.users import service

router = APIRouter()


def _require_self(target_id: str, current_user_id: str) -> None:
    if target_id != current_user_id:
        raise_error(
            code="RESOURCE_OWNERSHIP_VIOLATION",
            message="Access to this user is forbidden",
            http_status=status.HTTP_403_FORBIDDEN,
        )


@router.get("/me")
def get_me(current_user_id: str = Depends(get_current_user)):
    db = get_db()
    return success(data=service.get_user(db.users, current_user_id))


@router.get("/{id}")
def get_user(id: str, current_user_id: str = Depends(get_current_user)):
    _require_self(id, current_user_id)
    db = get_db()
    return success(data=service.get_user(db.users, id))


@router.put("/{id}")
def update_user(
    id: str,
    payload: UpdateUserRequest,
    current_user_id: str = Depends(get_current_user),
):
    _require_self(id, current_user_id)
    db = get_db()
    return success(data=service.update_user(db.users, id, payload))


@router.delete("/{id}")
def delete_user(id: str, current_user_id: str = Depends(get_current_user)):
    _require_self(id, current_user_id)
    db = get_db()
    service.delete_user(db.users, id)
    return success(data=None)
