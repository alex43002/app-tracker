"""Shared, ownership-safe query helpers for list endpoints.

Consolidates the previously duplicated `parse_filters` + pagination logic from the
jobs and alerts services, and closes the access-control hole where client-supplied
filters could override the `userId` scope or inject Mongo operators.
"""

import json
from typing import Any, Callable, Iterable

from fastapi import status
from pymongo.collection import Collection

from app.common.errors import raise_error


def validate_client_filters(parsed: dict, allowed_fields: Iterable[str]) -> dict:
    """Validate a parsed filter dict against a field whitelist.

    Filters are accepted only for whitelisted fields, may not contain Mongo
    operators (keys starting with ``$``), and may not use operator-object values.
    Returns the cleaned filter dict (without any ``userId`` scope). Raises the
    standard validation envelope on any violation.
    """
    allowed = set(allowed_fields)
    clean: dict[str, Any] = {}

    for key, value in parsed.items():
        if not isinstance(key, str) or key.startswith("$"):
            raise_error(
                code="VALIDATION_ERROR",
                message=f"Unsupported filter key: {key}",
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        if key not in allowed:
            raise_error(
                code="VALIDATION_ERROR",
                message=f"Filtering by '{key}' is not allowed",
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        # Reject operator objects as values (e.g. {"$gt": ...}).
        if isinstance(value, dict):
            raise_error(
                code="VALIDATION_ERROR",
                message=f"Invalid filter value for '{key}'",
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        clean[key] = value

    return clean


def parse_filters(
    raw_filters: str | None,
    user_id: str,
    allowed_fields: Iterable[str],
) -> dict:
    """Build a Mongo filter that is always scoped to ``user_id``.

    Client filters are accepted only for whitelisted fields, may not contain Mongo
    operators (keys starting with ``$``), and can never override ``userId``.
    """
    query: dict[str, Any] = {}

    if raw_filters:
        try:
            parsed = json.loads(raw_filters)
            if not isinstance(parsed, dict):
                raise ValueError
        except Exception:
            raise_error(
                code="VALIDATION_ERROR",
                message="Invalid filters format",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        query = validate_client_filters(parsed, allowed_fields)

    # userId is forced last so it can never be overridden by client input.
    query["userId"] = user_id
    return query


def paginate(
    collection: Collection,
    mongo_filters: dict,
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
    serializer: Callable[[dict], dict],
    sortable_fields: Iterable[str],
) -> dict:
    """Run a paginated, sorted query and return the standard list payload."""
    if sort_by not in set(sortable_fields):
        sort_by = "createdAt"
    sort_direction = 1 if sort_order == "asc" else -1
    skip = (page - 1) * page_size

    cursor = (
        collection.find(mongo_filters)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(page_size)
    )

    items = [serializer(doc) for doc in cursor]

    total_items = collection.count_documents(mongo_filters)
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
