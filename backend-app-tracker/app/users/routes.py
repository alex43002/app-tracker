from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from bson import ObjectId

from app.database import get_db
from app.common.auth import get_current_user
from app.common.responses import success
from app.common.errors import raise_error
from app.users.schemas import User, UpdateUserRequest, UpdateUserResponse

router = APIRouter()


@router.get("/{id}")
def get_user(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    # Ownership enforcement
    if id != current_user_id:
        raise_error(
            code="RESOURCE_OWNERSHIP_VIOLATION",
            message="Access to this user is forbidden",
            http_status=status.HTTP_403_FORBIDDEN,
        )

    db = get_db()
    users = db.users

    try:
        user = users.find_one({"_id": ObjectId(id)})
    except Exception:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Invalid user id",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    if not user:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    return success(
        data=User(
            id=str(user["_id"]),
            email=user["email"],
            phoneNumber=user["phoneNumber"],
            firstName=user["firstName"],
            lastName=user["lastName"],
            pfp=user["pfp"],
            createdAt=user["createdAt"],
            updatedAt=user["updatedAt"],
        ).dict()
    )


@router.put("/{id}")
def update_user(
    id: str,
    payload: UpdateUserRequest,
    current_user_id: str = Depends(get_current_user),
):
    if id != current_user_id:
        raise_error(
            code="RESOURCE_OWNERSHIP_VIOLATION",
            message="Access to this user is forbidden",
            http_status=status.HTTP_403_FORBIDDEN,
        )

    db = get_db()
    users = db.users

    update_fields = {
        k: v for k, v in payload.dict().items() if v is not None
    }

    if not update_fields:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields["updatedAt"] = datetime.now(tz=timezone.utc)

    result = users.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_fields},
    )

    if result.matched_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    return success(
        data=UpdateUserResponse(
            updatedAt=update_fields["updatedAt"]
        ).dict()
    )


@router.delete("/{id}")
def delete_user(
    id: str,
    current_user_id: str = Depends(get_current_user),
):
    if id != current_user_id:
        raise_error(
            code="RESOURCE_OWNERSHIP_VIOLATION",
            message="Access to this user is forbidden",
            http_status=status.HTTP_403_FORBIDDEN,
        )

    db = get_db()
    users = db.users

    result = users.delete_one({"_id": ObjectId(id)})

    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    return success(data=None)
