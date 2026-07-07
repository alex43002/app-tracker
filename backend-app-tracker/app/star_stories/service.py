"""STAR story persistence — per-user CRUD over the ``star_stories`` collection."""

from __future__ import annotations

from datetime import datetime, timezone

from pymongo.database import Database

from app.common.crud import (
    clean_str_list,
    object_id_or_404,
    owned_delete,
    owned_update,
)

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


def create_story(db: Database, payload, user_id: str) -> dict:
    now = datetime.now(tz=timezone.utc)
    doc = {
        "userId": user_id,
        "title": payload.title.strip(),
        "situation": payload.situation,
        "task": payload.task,
        "action": payload.action,
        "result": payload.result,
        "tags": clean_str_list(payload.tags),
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
    object_id = object_id_or_404(story_id, message="Story not found")
    updates: dict = {}
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    for field in _TEXT_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            updates[field] = value
    if payload.tags is not None:
        updates["tags"] = clean_str_list(payload.tags)

    doc = owned_update(
        db.star_stories, object_id, user_id, updates, message="Story not found"
    )
    return _serialize(doc)


def delete_story(db: Database, story_id: str, user_id: str) -> None:
    object_id = object_id_or_404(story_id, message="Story not found")
    owned_delete(db.star_stories, object_id, user_id, message="Story not found")
