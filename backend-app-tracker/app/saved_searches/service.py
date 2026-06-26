"""Saved searches (FEAT-11).

A saved search is a named, reusable job-list query (filters + sort) owned by a
user. Filters are validated against the same whitelist the jobs list endpoint
uses, so a stored search can't smuggle in disallowed fields or Mongo operators —
this is safe to build on the hardened filter mechanism (SEC-1).
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import status
from pymongo.collection import Collection

from app.common.errors import raise_error
from app.common.query import validate_client_filters
from app.jobs.service import JOB_FILTERABLE_FIELDS, JOB_SORTABLE_FIELDS

_SORT_ORDERS = ("asc", "desc")


def _validate_filters(filters: dict) -> dict:
    return validate_client_filters(filters, JOB_FILTERABLE_FIELDS)


def _validate_sort(sort_by: str, sort_order: str) -> None:
    if sort_by not in set(JOB_SORTABLE_FIELDS):
        raise_error(
            code="VALIDATION_ERROR",
            message=f"Sorting by '{sort_by}' is not allowed",
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    if sort_order not in _SORT_ORDERS:
        raise_error(
            code="VALIDATION_ERROR",
            message="sortOrder must be 'asc' or 'desc'",
            http_status=status.HTTP_400_BAD_REQUEST,
        )


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "filters": doc.get("filters", {}),
        "sortBy": doc.get("sortBy", "createdAt"),
        "sortOrder": doc.get("sortOrder", "asc"),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


def _object_id(search_id: str):
    try:
        return ObjectId(search_id)
    except (InvalidId, TypeError):
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Saved search not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )


def create_saved_search(searches: Collection, payload, user_id: str) -> dict:
    filters = _validate_filters(payload.filters)
    _validate_sort(payload.sortBy, payload.sortOrder)

    now = datetime.now(tz=timezone.utc)
    doc = {
        "userId": user_id,
        "name": payload.name,
        "filters": filters,
        "sortBy": payload.sortBy,
        "sortOrder": payload.sortOrder,
        "createdAt": now,
        "updatedAt": now,
    }
    result = searches.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def list_saved_searches(searches: Collection, user_id: str) -> dict:
    cursor = searches.find({"userId": user_id}).sort("createdAt", 1)
    return {"items": [_serialize(doc) for doc in cursor]}


def update_saved_search(
    searches: Collection, search_id: str, user_id: str, payload
) -> dict:
    object_id = _object_id(search_id)

    update_fields: dict = {}
    if payload.name is not None:
        update_fields["name"] = payload.name
    if payload.filters is not None:
        update_fields["filters"] = _validate_filters(payload.filters)
    if payload.sortBy is not None or payload.sortOrder is not None:
        existing = searches.find_one({"_id": object_id, "userId": user_id})
        if not existing:
            raise_error(
                code="RESOURCE_NOT_FOUND",
                message="Saved search not found",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        sort_by = payload.sortBy if payload.sortBy is not None else existing["sortBy"]
        sort_order = (
            payload.sortOrder
            if payload.sortOrder is not None
            else existing["sortOrder"]
        )
        _validate_sort(sort_by, sort_order)
        update_fields["sortBy"] = sort_by
        update_fields["sortOrder"] = sort_order

    if not update_fields:
        raise_error(
            code="VALIDATION_ERROR",
            message="No fields provided for update",
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields["updatedAt"] = datetime.now(tz=timezone.utc)
    doc = searches.find_one_and_update(
        {"_id": object_id, "userId": user_id},
        {"$set": update_fields},
        return_document=True,
    )
    if not doc:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Saved search not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
    return _serialize(doc)


def delete_saved_search(searches: Collection, search_id: str, user_id: str) -> None:
    object_id = _object_id(search_id)
    result = searches.delete_one({"_id": object_id, "userId": user_id})
    if result.deleted_count == 0:
        raise_error(
            code="RESOURCE_NOT_FOUND",
            message="Saved search not found",
            http_status=status.HTTP_404_NOT_FOUND,
        )
