"""User preferences storage (one document per user, upserted)."""

from __future__ import annotations

from datetime import datetime, timezone

_LIST_FIELDS = ("preferredCompanies", "hiddenCompanies", "hiddenEmploymentTypes")

_DEFAULTS = {field: [] for field in _LIST_FIELDS}


def _clean_list(values: list[str]) -> list[str]:
    """Trim, drop blanks, de-dupe (case-insensitive) while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        item = (value or "").strip()
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def get_preferences(db, user_id: str) -> dict:
    doc = db.user_preferences.find_one({"userId": user_id})
    if not doc:
        return dict(_DEFAULTS)
    return {field: doc.get(field, []) for field in _LIST_FIELDS}


def update_preferences(db, user_id: str, payload) -> dict:
    updates = {}
    for field in _LIST_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            updates[field] = _clean_list(value)

    updates["updatedAt"] = datetime.now(tz=timezone.utc)
    db.user_preferences.update_one(
        {"userId": user_id},
        {"$set": updates, "$setOnInsert": {"userId": user_id}},
        upsert=True,
    )
    return get_preferences(db, user_id)
