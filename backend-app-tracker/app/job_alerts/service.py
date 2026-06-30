"""Saved discovery searches + job-alert delivery (FEAT-22)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import status
from pymongo.database import Database

from app.common.errors import raise_error
from app.discovery.service import clean_criteria, criteria_query
from app.notifications.notifier import EMAIL, Notifier

logger = logging.getLogger("careerlog.alerts")


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "criteria": doc.get("criteria", {}),
        "notify": doc.get("notify", True),
        "lastCheckedAt": doc.get("lastCheckedAt"),
        "lastNotifiedAt": doc.get("lastNotifiedAt"),
        "lastMatchCount": doc.get("lastMatchCount", 0),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


def _object_id(alert_id: str):
    try:
        return ObjectId(alert_id)
    except (InvalidId, TypeError):
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job alert not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )


def create_job_alert(db: Database, payload, user_id: str) -> dict:
    now = datetime.now(tz=timezone.utc)
    doc = {
        "userId": user_id,
        "name": payload.name,
        "criteria": clean_criteria(payload.criteria),
        "notify": payload.notify,
        "lastCheckedAt": None,
        "lastNotifiedAt": None,
        "lastMatchCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    result = db.job_alerts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def list_job_alerts(db: Database, user_id: str) -> dict:
    cursor = db.job_alerts.find({"userId": user_id}).sort("createdAt", 1)
    return {"items": [_serialize(doc) for doc in cursor]}


def update_job_alert(db: Database, alert_id: str, user_id: str, payload) -> dict:
    object_id = _object_id(alert_id)
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.criteria is not None:
        updates["criteria"] = clean_criteria(payload.criteria)
    if payload.notify is not None:
        updates["notify"] = payload.notify

    if not updates:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    updates["updatedAt"] = datetime.now(tz=timezone.utc)
    doc = db.job_alerts.find_one_and_update(
        {"_id": object_id, "userId": user_id},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job alert not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return _serialize(doc)


def delete_job_alert(db: Database, alert_id: str, user_id: str) -> None:
    object_id = _object_id(alert_id)
    result = db.job_alerts.delete_one({"_id": object_id, "userId": user_id})
    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job alert not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )


# ---------------------------------------------------------------------------
# Matching / delivery
# ---------------------------------------------------------------------------

def _count_matches(db: Database, criteria: dict, since: datetime | None) -> int:
    query = criteria_query(criteria)
    if since is not None:
        query = {**query, "ingestedAt": {"$gt": since}}
    return db.discovered_jobs.count_documents(query)


def _notify(
    db: Database, alert: dict, notifier: Notifier, new_matches: int
) -> bool:
    """Send the alert's owner a notification. Returns True if delivered."""
    try:
        user = db.users.find_one({"_id": ObjectId(alert["userId"])})
    except (InvalidId, TypeError):
        user = None
    if not user:
        return False
    message = (
        f"{new_matches} new job(s) match your saved search "
        f"\"{alert['name']}\" on CareerLog."
    )
    try:
        notifier.send(EMAIL, user.get("email"), message)
    except Exception:
        logger.exception("Failed to deliver job alert %s", alert.get("_id"))
        return False
    return True


def check_alert(
    db: Database,
    alert_id: str,
    user_id: str,
    notifier: Notifier | None,
    now: datetime | None = None,
) -> dict:
    """Re-run a saved search now: count new + total matches, update timestamps.

    Notifies the owner when ``notify`` is set and there are new matches.
    """
    now = now or datetime.now(tz=timezone.utc)
    object_id = _object_id(alert_id)
    alert = db.job_alerts.find_one({"_id": object_id, "userId": user_id})
    if not alert:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Job alert not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    criteria = alert.get("criteria", {})
    since = alert.get("lastCheckedAt") or alert.get("createdAt")
    new_matches = _count_matches(db, criteria, since)
    total = _count_matches(db, criteria, None)

    updates = {"lastCheckedAt": now, "lastMatchCount": new_matches}
    if new_matches > 0 and alert.get("notify") and notifier is not None:
        if _notify(db, alert, notifier, new_matches):
            updates["lastNotifiedAt"] = now
    db.job_alerts.update_one({"_id": object_id}, {"$set": updates})

    return {"newMatches": new_matches, "total": total}


def process_due_job_alerts(db: Database, notifier: Notifier, now: datetime) -> int:
    """Notify on every alert with new matches since it was last checked.

    Returns the number of alerts that produced a notification. Safe to call on a
    schedule; each alert advances its own ``lastCheckedAt`` so matches aren't
    re-reported.
    """
    notified = 0
    for alert in db.job_alerts.find({"notify": True}):
        since = alert.get("lastCheckedAt") or alert.get("createdAt")
        new_matches = _count_matches(db, alert.get("criteria", {}), since)
        updates = {"lastCheckedAt": now, "lastMatchCount": new_matches}
        if new_matches > 0 and _notify(db, alert, notifier, new_matches):
            updates["lastNotifiedAt"] = now
            notified += 1
        db.job_alerts.update_one({"_id": alert["_id"]}, {"$set": updates})
    return notified
