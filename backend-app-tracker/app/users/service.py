from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import status
from pymongo.collection import Collection

from app.common.errors import raise_error
from app.users.schemas import User


def _to_object_id(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except (InvalidId, TypeError):
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Invalid user id",
            http_status=status.HTTP_404_NOT_FOUND,
        )


def _serialize_user(doc: dict) -> dict:
    return User(
        id=str(doc["_id"]),
        email=doc["email"],
        phoneNumber=doc["phoneNumber"],
        firstName=doc["firstName"],
        lastName=doc["lastName"],
        pfp=doc["pfp"],
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    ).model_dump()


def get_user(users: Collection, user_id: str) -> dict:
    user = users.find_one({"_id": _to_object_id(user_id)})
    if not user:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return _serialize_user(user)


def update_user(users: Collection, user_id: str, payload) -> dict:
    update_fields = {
        k: v for k, v in payload.model_dump().items() if v is not None
    }

    if not update_fields:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields["updatedAt"] = datetime.now(tz=timezone.utc)

    result = users.update_one(
        {"_id": _to_object_id(user_id)},
        {"$set": update_fields},
    )

    if result.matched_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    return {"updatedAt": update_fields["updatedAt"]}


def delete_user(users: Collection, user_id: str) -> None:
    result = users.delete_one({"_id": _to_object_id(user_id)})
    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
