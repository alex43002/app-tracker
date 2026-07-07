"""Shared helpers for per-user CRUD services.

Consolidates the ObjectId-or-404 parsing, ownership-scoped update/delete, and the
"no fields provided" validation that were copy-pasted across the ``star_stories``,
``offers``, ``saved_searches``, and ``job_alerts`` services. Every helper keeps
the existing behaviour: writes are always scoped to ``(_id, userId)`` so a caller
can never touch another user's document, and a miss raises the standard 404
envelope with a resource-specific message.
"""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import status
from pymongo.collection import Collection

from app.common.errors import raise_error


def object_id_or_404(raw_id: str, *, message: str) -> ObjectId:
    """Parse an id into an ``ObjectId`` or raise the standard 404 envelope."""
    try:
        return ObjectId(raw_id)
    except (InvalidId, TypeError):
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message=message,
            http_status=status.HTTP_404_NOT_FOUND,
        )


def owned_update(
    collection: Collection,
    object_id: ObjectId,
    user_id: str,
    updates: dict,
    *,
    message: str,
    stamp_updated_at: bool = True,
) -> dict:
    """Apply ``updates`` to a user-owned document and return it.

    Raises the standard 400 envelope when ``updates`` is empty and the standard
    404 (``message``) when no owned document matches. ``updatedAt`` is stamped
    unless ``stamp_updated_at`` is False.
    """
    if not updates:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    if stamp_updated_at:
        updates = {**updates, "updatedAt": datetime.now(tz=timezone.utc)}
    doc = collection.find_one_and_update(
        {"_id": object_id, "userId": user_id},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message=message,
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return doc


def owned_delete(
    collection: Collection, object_id: ObjectId, user_id: str, *, message: str
) -> None:
    """Delete a user-owned document, raising the standard 404 when absent."""
    result = collection.delete_one({"_id": object_id, "userId": user_id})
    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message=message,
            http_status=status.HTTP_404_NOT_FOUND,
        )


def clean_str_list(values: list[str] | None) -> list[str]:
    """Trim, drop blanks, and de-dupe (case-insensitive) preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for value in values or []:
        item = (value or "").strip()
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
    return out
