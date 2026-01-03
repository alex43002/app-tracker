from datetime import datetime, timezone
import json
from bson import ObjectId
from pymongo.collection import Collection
from fastapi import status

from app.common.errors import raise_error


def parse_filters(raw_filters: str | None, user_id: str) -> dict:
    base = {"userId": user_id}

    if not raw_filters:
        return base

    try:
        filters = json.loads(raw_filters)
        if not isinstance(filters, dict):
            raise ValueError
    except Exception:
        raise_error(
            code="VALIDATION_ERROR",
            message="Invalid filters format",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    base.update(filters)
    return base


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
    mongo_filters = parse_filters(filters, user_id)

    sort_direction = 1 if sort_order == "asc" else -1
    skip = (page - 1) * page_size

    cursor = (
        alerts.find(mongo_filters)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(page_size)
    )

    items = []
    for alert in cursor:
        items.append({
            "id": str(alert["_id"]),
            "userId": alert["userId"],
            "scheduledAlert": alert["scheduledAlert"],
            "smsOrEmail": alert["smsOrEmail"],
            "message": alert["message"],
            "lastAlertAt": alert.get("lastAlertAt"),
            "createdAt": alert["createdAt"],
            "updatedAt": alert["updatedAt"],
        })

    total_items = alerts.count_documents(mongo_filters)
    total_pages = (total_items + page_size - 1) // page_size

    return {
        "items": items,
        "meta": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def update_alert(alerts: Collection, alert_id: str, user_id: str, payload):
    update_fields = {
        k: v
        for k, v in payload.dict().items()
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
