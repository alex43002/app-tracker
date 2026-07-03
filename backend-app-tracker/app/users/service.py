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
        emailVerified=doc.get("emailVerified", False),
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
    oid = _to_object_id(user_id)
    existing = users.find_one({"_id": oid})
    if not existing:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="User not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    update_fields = {
        k: v for k, v in payload.model_dump().items() if v is not None
    }

    # Email change (FEAT-28): normalize, enforce uniqueness, and require the new
    # address to be re-verified. An unchanged email is dropped so we never reset
    # verification for a no-op edit.
    new_email = update_fields.get("email")
    if new_email is not None:
        normalized = str(new_email).strip().lower()
        if normalized == existing.get("email"):
            update_fields.pop("email")
        else:
            taken = users.find_one(
                {"email": normalized, "_id": {"$ne": oid}}, {"_id": 1}
            )
            if taken:
                raise_error(
                    code="EMAIL_TAKEN",
                    message="That email address is already in use",
                    http_status=status.HTTP_409_CONFLICT,
                )
            update_fields["email"] = normalized
            update_fields["emailVerified"] = False

    if not update_fields:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields["updatedAt"] = datetime.now(tz=timezone.utc)

    users.update_one({"_id": oid}, {"$set": update_fields})

    return {
        "updatedAt": update_fields["updatedAt"],
        "emailVerified": update_fields.get(
            "emailVerified", existing.get("emailVerified", False)
        ),
    }


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
