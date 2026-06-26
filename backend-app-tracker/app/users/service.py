from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import status
from gridfs import GridFS
from pymongo.collection import Collection
from pymongo.database import Database

from app.common.errors import raise_error
from app.users.schemas import User

# Profile-picture upload constraints.
ALLOWED_PFP_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_PFP_BYTES = 2 * 1024 * 1024  # 2 MB


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
        pfp=doc.get("pfp"),
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


# ---------------------------------------------------------------------------
# Profile pictures (GridFS) — SEC-6 / FEAT-3
# ---------------------------------------------------------------------------

def _read_validated_pfp(upload) -> bytes:
    if upload is None or not hasattr(upload, "content_type"):
        raise_error(
            code="VALIDATION_ERROR",
            message="No profile picture file provided",
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    if upload.content_type not in ALLOWED_PFP_TYPES:
        raise_error(
            code="VALIDATION_ERROR",
            message="Unsupported image type (use png, jpeg, webp, or gif)",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    data = upload.file.read()
    if len(data) > MAX_PFP_BYTES:
        raise_error(
            code="VALIDATION_ERROR",
            message="Profile picture exceeds the 2MB size limit",
            http_status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )
    return data


def _require_user(db: Database, user_id: str) -> dict:
    user = db.users.find_one({"_id": _to_object_id(user_id)})
    if not user:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return user


def set_profile_picture(db: Database, user_id: str, upload) -> dict:
    """Store a new profile picture in GridFS, replacing any existing one."""
    data = _read_validated_pfp(upload)
    user = _require_user(db, user_id)

    fs = GridFS(db)
    old = user.get("pfp")
    if old:
        try:
            fs.delete(ObjectId(old))
        except (InvalidId, TypeError):
            pass

    file_id = str(
        fs.put(
            data,
            filename=getattr(upload, "filename", "avatar"),
            content_type=upload.content_type,
            metadata={"userId": user_id},
        )
    )

    now = datetime.now(tz=timezone.utc)
    db.users.update_one(
        {"_id": _to_object_id(user_id)},
        {"$set": {"pfp": file_id, "updatedAt": now}},
    )
    return {"pfp": file_id, "updatedAt": now}


def get_profile_picture_file(db: Database, user_id: str):
    user = _require_user(db, user_id)
    pfp_id = user.get("pfp")
    if not pfp_id:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="No profile picture set",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    try:
        return GridFS(db).get(ObjectId(pfp_id))
    except Exception:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Profile picture not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )


def delete_profile_picture(db: Database, user_id: str) -> None:
    user = _require_user(db, user_id)
    pfp_id = user.get("pfp")
    if pfp_id:
        try:
            GridFS(db).delete(ObjectId(pfp_id))
        except (InvalidId, TypeError):
            pass

    db.users.update_one(
        {"_id": _to_object_id(user_id)},
        {"$set": {"pfp": None, "updatedAt": datetime.now(tz=timezone.utc)}},
    )
