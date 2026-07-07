"""Offer persistence — per-user CRUD over the ``offers`` collection."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import status
from pymongo.database import Database

from app.common.crud import object_id_or_404, owned_delete, owned_update
from app.common.errors import raise_error
from app.offers.schemas import OFFER_STATUSES

# Numeric/rating fields that pass straight through create/update.
_NUMERIC_FIELDS = (
    "baseSalary",
    "bonus",
    "equityPerYear",
    "signOnBonus",
    "benefitsRating",
    "flexibilityRating",
    "fitRating",
)
_STRING_FIELDS = ("company", "role", "location", "notes")


def _total_comp(doc: dict) -> float:
    """Annual recurring comp: base + bonus + equity/yr (sign-on is one-time)."""
    return float(
        (doc.get("baseSalary") or 0)
        + (doc.get("bonus") or 0)
        + (doc.get("equityPerYear") or 0)
    )


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "company": doc["company"],
        "role": doc["role"],
        "location": doc.get("location", ""),
        "baseSalary": doc.get("baseSalary"),
        "bonus": doc.get("bonus"),
        "equityPerYear": doc.get("equityPerYear"),
        "signOnBonus": doc.get("signOnBonus"),
        "benefitsRating": doc.get("benefitsRating"),
        "flexibilityRating": doc.get("flexibilityRating"),
        "fitRating": doc.get("fitRating"),
        "notes": doc.get("notes", ""),
        "status": doc.get("status", "received"),
        "totalComp": _total_comp(doc),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


def _validate_status(value: str) -> str:
    if value not in OFFER_STATUSES:
        raise_error(
            code="VALIDATION_ERROR",
            message="Invalid status. Allowed: " + ", ".join(OFFER_STATUSES),
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    return value


def create_offer(db: Database, payload, user_id: str) -> dict:
    now = datetime.now(tz=timezone.utc)
    doc = {
        "userId": user_id,
        "company": payload.company.strip(),
        "role": payload.role.strip(),
        "location": payload.location.strip(),
        "notes": payload.notes,
        "status": _validate_status(payload.status),
        "createdAt": now,
        "updatedAt": now,
    }
    for field in _NUMERIC_FIELDS:
        doc[field] = getattr(payload, field)
    result = db.offers.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def list_offers(db: Database, user_id: str) -> dict:
    cursor = db.offers.find({"userId": user_id}).sort("createdAt", -1)
    return {"items": [_serialize(doc) for doc in cursor]}


def update_offer(db: Database, offer_id: str, user_id: str, payload) -> dict:
    object_id = object_id_or_404(offer_id, message="Offer not found")
    updates: dict = {}
    for field in _STRING_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            updates[field] = value.strip() if field != "notes" else value
    for field in _NUMERIC_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            updates[field] = value
    if payload.status is not None:
        updates["status"] = _validate_status(payload.status)

    doc = owned_update(db.offers, object_id, user_id, updates, message="Offer not found")
    return _serialize(doc)


def delete_offer(db: Database, offer_id: str, user_id: str) -> None:
    object_id = object_id_or_404(offer_id, message="Offer not found")
    owned_delete(db.offers, object_id, user_id, message="Offer not found")
