from fastapi import APIRouter, Depends, Request, Response, status

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.common.errors import raise_error
from app.users.schemas import UpdateUserRequest, UpdateUserResponse
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
    result = service.update_user(db.users, id, payload)
    return success(data=UpdateUserResponse(**result).model_dump())


@router.delete("/{id}")
def delete_user(id: str, current_user_id: str = Depends(get_current_user)):
    _require_self(id, current_user_id)
    db = get_db()
    service.delete_user(db.users, id)
    return success(data=None)


# ---- Profile picture (GridFS) ----

@router.put("/{id}/pfp")
async def upload_profile_picture(
    id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user),
):
    _require_self(id, current_user_id)
    form = await request.form()
    upload = form.get("pfp")
    return success(data=service.set_profile_picture(get_db(), id, upload))


@router.get("/{id}/pfp")
def get_profile_picture(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    _require_self(id, current_user_id)
    file = service.get_profile_picture_file(get_db(), id)
    return Response(
        content=file.read(),
        media_type=file.content_type,
        headers={"Content-Disposition": f'inline; filename="{file.filename}"'},
    )


@router.delete("/{id}/pfp")
def delete_profile_picture(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    _require_self(id, current_user_id)
    service.delete_profile_picture(get_db(), id)
    return success(data=None)
