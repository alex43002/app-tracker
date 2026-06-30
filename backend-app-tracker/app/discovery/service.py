"""Discovery service: ingest normalized postings and serve filtered queries.

Postings live in a shared ``discovered_jobs`` collection keyed by
``(source, sourceId)`` so re-ingesting a board updates existing rows instead of
duplicating them. Listing is global (postings are public) but auth-gated.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import status
from pymongo.collection import Collection

from app.common.errors import raise_error
from app.common.query import paginate
from app.discovery.connectors import ConnectorError, SUPPORTED_SOURCES, fetch_source

# Fields a client may sort discovered jobs by.
SORTABLE_FIELDS = ("postedAt", "ingestedAt", "company", "title", "salaryMax")


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def ingest(db, source: str, token: str, company: str | None) -> dict:
    """Fetch a board and upsert its postings. Returns counts."""
    if source not in SUPPORTED_SOURCES:
        raise_error(
            code="UNSUPPORTED_SOURCE",
            message=f"Unsupported source '{source}'. Supported: "
            + ", ".join(SUPPORTED_SOURCES),
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        postings = fetch_source(source, token, company)
    except ConnectorError as exc:
        raise_error(
            code="DISCOVERY_FETCH_FAILED",
            message=str(exc),
            http_status=status.HTTP_400_BAD_REQUEST,
        )

    jobs: Collection = db.discovered_jobs
    now = datetime.now(tz=timezone.utc)
    inserted = 0
    updated = 0
    for posting in postings:
        if not posting.get("sourceId") or not posting.get("title"):
            continue
        # ATS posting ids are unique per board, not globally, so the dedupe key
        # includes the board token.
        posting["boardToken"] = token
        # Bound stored/served description size.
        posting["description"] = (posting.get("description") or "")[:5000]
        posting["updatedAt"] = now
        result = jobs.update_one(
            {
                "source": posting["source"],
                "boardToken": token,
                "sourceId": posting["sourceId"],
            },
            {"$set": posting, "$setOnInsert": {"ingestedAt": now}},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted += 1
        elif result.modified_count:
            updated += 1

    return {
        "source": source,
        "company": company or token,
        "fetched": len(postings),
        "inserted": inserted,
        "updated": updated,
    }


def _escape_regex(value: str) -> dict:
    return {"$regex": re.escape(value), "$options": "i"}


def _build_query(
    *,
    q: str | None,
    company: str | None,
    location: str | None,
    employment_type: str | None,
    source: str | None,
    salary_min: int | None,
) -> dict:
    """Build a safe Mongo filter — every operator is server-constructed."""
    query: dict = {}
    if q:
        query["title"] = _escape_regex(q)
    if company:
        query["company"] = _escape_regex(company)
    if location:
        query["location"] = _escape_regex(location)
    if employment_type:
        query["employmentType"] = employment_type
    if source:
        query["source"] = source
    if salary_min is not None:
        # A posting qualifies if the top of its range meets the floor.
        query["salaryMax"] = {"$gte": salary_min}
    return query


def list_jobs(
    db,
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
    q: str | None = None,
    company: str | None = None,
    location: str | None = None,
    employment_type: str | None = None,
    source: str | None = None,
    salary_min: int | None = None,
) -> dict:
    query = _build_query(
        q=q,
        company=company,
        location=location,
        employment_type=employment_type,
        source=source,
        salary_min=salary_min,
    )
    if sort_by not in set(SORTABLE_FIELDS):
        sort_by = "postedAt"
    return paginate(
        db.discovered_jobs,
        query,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        serializer=_serialize,
        sortable_fields=SORTABLE_FIELDS,
    )
