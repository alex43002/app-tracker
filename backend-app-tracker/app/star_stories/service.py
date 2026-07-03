"""STAR story persistence — per-user CRUD over the ``star_stories`` collection."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import status
from pymongo.database import Database

from app.common.errors import raise_error

_TEXT_FIELDS = ("situation", "task", "action", "result")


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "situation": doc.get("situation", ""),
        "task": doc.get("task", ""),
        "action": doc.get("action", ""),
        "result": doc.get("result", ""),
        "tags": doc.get("tags", []),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


def _object_id(story_id: str):
    try:
        return ObjectId(story_id)
    except (InvalidId, TypeError):
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Story not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )


def _clean_tags(tags: list[str]) -> list[str]:
    """Trim, drop blanks, de-dupe (case-insensitive) preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for tag in tags:
        item = (tag or "").strip()
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def create_story(db: Database, payload, user_id: str) -> dict:
    now = datetime.now(tz=timezone.utc)
    doc = {
        "userId": user_id,
        "title": payload.title.strip(),
        "situation": payload.situation,
        "task": payload.task,
        "action": payload.action,
        "result": payload.result,
        "tags": _clean_tags(payload.tags),
        "createdAt": now,
        "updatedAt": now,
    }
    result = db.star_stories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def list_stories(db: Database, user_id: str) -> dict:
    cursor = db.star_stories.find({"userId": user_id}).sort("updatedAt", -1)
    return {"items": [_serialize(doc) for doc in cursor]}


def update_story(db: Database, story_id: str, user_id: str, payload) -> dict:
    object_id = _object_id(story_id)
    updates: dict = {}
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    for field in _TEXT_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            updates[field] = value
    if payload.tags is not None:
        updates["tags"] = _clean_tags(payload.tags)

    if not updates:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    updates["updatedAt"] = datetime.now(tz=timezone.utc)
    doc = db.star_stories.find_one_and_update(
        {"_id": object_id, "userId": user_id},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Story not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return _serialize(doc)


def delete_story(db: Database, story_id: str, user_id: str) -> None:
    object_id = _object_id(story_id)
    result = db.star_stories.delete_one({"_id": object_id, "userId": user_id})
    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Story not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
