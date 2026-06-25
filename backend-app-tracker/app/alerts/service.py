import logging
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.collection import Collection
from pymongo.database import Database
from fastapi import status

from app.common.errors import raise_error
from app.common.query import parse_filters, paginate
from app.notifications.notifier import EMAIL, Notifier

logger = logging.getLogger("careerlog.alerts")

# Fields a client is allowed to filter / sort alerts by.
ALERT_FILTERABLE_FIELDS = ("smsOrEmail",)
ALERT_SORTABLE_FIELDS = ("createdAt", "updatedAt", "scheduledAlert")


def _serialize_alert(alert: dict) -> dict:
    return {
        "id": str(alert["_id"]),
        "userId": alert["userId"],
        "scheduledAlert": alert["scheduledAlert"],
        "smsOrEmail": alert["smsOrEmail"],
        "message": alert["message"],
        "lastAlertAt": alert.get("lastAlertAt"),
        "createdAt": alert["createdAt"],
        "updatedAt": alert["updatedAt"],
    }


def create_alert(alerts: Collection, payload, user_id: str):
    now = datetime.now(tz=timezone.utc)

    alert_doc = {
        "userId": user_id,
        "scheduledAlert": payload.scheduledAlert,
        "smsOrEmail": payload.smsOrEmail,
        "message": payload.message,
        "lastAlertAt": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = alerts.insert_one(alert_doc)

    return {
        "id": str(result.inserted_id),
        "createdAt": now,
        "updatedAt": now,
    }


def list_alerts(
    alerts: Collection,
    user_id: str,
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
    filters: str | None,
):
    mongo_filters = parse_filters(filters, user_id, ALERT_FILTERABLE_FIELDS)

    return paginate(
        alerts,
        mongo_filters,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        serializer=_serialize_alert,
        sortable_fields=ALERT_SORTABLE_FIELDS,
    )


def update_alert(alerts: Collection, alert_id: str, user_id: str, payload):
    update_fields = {
        k: v
        for k, v in payload.model_dump().items()
        if v is not None
    }

    if not update_fields:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields["updatedAt"] = datetime.now(tz=timezone.utc)

    result = alerts.update_one(
        {"_id": ObjectId(alert_id), "userId": user_id},
        {"$set": update_fields},
    )

    if result.matched_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Alert not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )

    return {"updatedAt": update_fields["updatedAt"]}


def delete_alert(alerts: Collection, alert_id: str, user_id: str):
    result = alerts.delete_one(
        {"_id": ObjectId(alert_id), "userId": user_id}
    )

    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Alert not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )


# ---------------------------------------------------------------------------
# Alert delivery (FEAT-4)
# ---------------------------------------------------------------------------

def _to_naive_utc(dt: datetime | None) -> datetime | None:
    """Normalize to naive UTC — MongoDB stores datetimes without tzinfo."""
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _is_due(alert: dict, now: datetime) -> bool:
    """An alert fires when its scheduled time has passed and it hasn't already
    fired for the current schedule (supports rescheduling)."""
    scheduled = _to_naive_utc(alert.get("scheduledAlert"))
    if scheduled is None or scheduled > now:
        return False
    last = _to_naive_utc(alert.get("lastAlertAt"))
    return last is None or last < scheduled


def process_due_alerts(db: Database, notifier: Notifier, now: datetime) -> int:
    """Deliver every due alert and stamp ``lastAlertAt``. Returns the count sent.

    Designed to be idempotent per schedule and safe to call repeatedly.
    """
    now = _to_naive_utc(now)
    sent = 0
    for alert in db.alerts.find({"scheduledAlert": {"$lte": now}}):
        if not _is_due(alert, now):
            continue

        try:
            user = db.users.find_one({"_id": ObjectId(alert["userId"])})
        except (InvalidId, TypeError):
            user = None
        if not user:
            continue

        channel = alert.get("smsOrEmail", EMAIL)
        recipient = user.get("email") if channel == EMAIL else user.get("phoneNumber")

        try:
            notifier.send(channel, recipient, alert.get("message", ""))
        except Exception:
            logger.exception("Failed to deliver alert %s", alert.get("_id"))
            continue

        db.alerts.update_one(
            {"_id": alert["_id"]},
            {"$set": {"lastAlertAt": now}},
        )
        sent += 1

    return sent
