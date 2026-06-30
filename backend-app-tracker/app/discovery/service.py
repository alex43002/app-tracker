"""Discovery service: ingest normalized postings and serve filtered queries.

Postings live in a shared ``discovered_jobs`` collection keyed by
``(source, sourceId)`` so re-ingesting a board updates existing rows instead of
duplicating them. Listing is global (postings are public) but auth-gated.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from fastapi import status
from pymongo.collection import Collection

from app.common.errors import raise_error
from app.common.query import paginate
from app.discovery.connectors import ConnectorError, SUPPORTED_SOURCES, fetch_source
from app.discovery.enrich import enrich

# Fields a client may sort discovered jobs by.
SORTABLE_FIELDS = ("postedAt", "ingestedAt", "company", "title", "salaryMax")

# When collapsing duplicates we group in Python, so cap how many matching rows we
# scan to keep the query bounded.
COLLAPSE_SCAN_CAP = 2000


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
        # Derived eligibility/quality/dedupe signals (computed once at ingest).
        posting.update(enrich(posting))
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
    experience_level: str | None,
    requires_degree: bool | None,
    sponsorship_available: bool | None,
    clearance_required: bool | None,
    max_age_days: int | None,
    min_quality: int | None,
    preferred_companies: list[str] | None = None,
    hidden_companies: list[str] | None = None,
    hidden_employment_types: list[str] | None = None,
    preferred_only: bool = False,
) -> dict:
    """Build a safe Mongo filter — every operator is server-constructed."""
    query: dict = {}
    if q:
        query["title"] = _escape_regex(q)
    if location:
        query["location"] = _escape_regex(location)
    if source:
        query["source"] = source
    if salary_min is not None:
        # A posting qualifies if the top of its range meets the floor.
        query["salaryMax"] = {"$gte": salary_min}
    if experience_level:
        query["experienceLevel"] = experience_level
    if requires_degree is not None:
        query["requiresDegree"] = requires_degree
    if sponsorship_available is not None:
        query["sponsorshipAvailable"] = sponsorship_available
    if clearance_required is not None:
        query["clearanceRequired"] = clearance_required
    if max_age_days is not None:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=max_age_days)
        query["postedAt"] = {"$gte": cutoff}
    if min_quality is not None:
        query["qualityScore"] = {"$gte": min_quality}

    # Company filter precedence: an explicit search wins; otherwise apply the
    # user's preferences (preferred-only, then hide-list).
    if company:
        query["company"] = _escape_regex(company)
    elif preferred_only and preferred_companies:
        query["company"] = {"$in": preferred_companies}
    elif hidden_companies:
        query["company"] = {"$nin": hidden_companies}

    # Employment type: explicit filter wins; otherwise drop hidden types.
    if employment_type:
        query["employmentType"] = employment_type
    elif hidden_employment_types:
        query["employmentType"] = {"$nin": hidden_employment_types}

    return query


# Discovery filter criteria (camelCase, as the client sends them) → the
# _build_query keyword args. Used by saved job alerts to reuse the exact same
# filtering as the live Discover query.
CRITERIA_FIELDS = {
    "q": "q",
    "company": "company",
    "location": "location",
    "employmentType": "employment_type",
    "source": "source",
    "salaryMin": "salary_min",
    "experienceLevel": "experience_level",
    "requiresDegree": "requires_degree",
    "sponsorshipAvailable": "sponsorship_available",
    "clearanceRequired": "clearance_required",
    "maxAgeDays": "max_age_days",
    "minQuality": "min_quality",
}


def clean_criteria(criteria: dict) -> dict:
    """Keep only allowed discovery-filter keys with non-empty values."""
    return {
        key: value
        for key, value in (criteria or {}).items()
        if key in CRITERIA_FIELDS and value not in (None, "")
    }


def criteria_query(criteria: dict) -> dict:
    """Build the Mongo filter for a saved alert's criteria (no preferences)."""
    kwargs = {arg: None for arg in CRITERIA_FIELDS.values()}
    for key, value in clean_criteria(criteria).items():
        kwargs[CRITERIA_FIELDS[key]] = value
    return _build_query(**kwargs)


def _collapse(docs: list[dict], page: int, page_size: int) -> tuple[list[dict], int]:
    """Merge duplicate postings (same ``dedupeKey``) into one listing.

    ``docs`` must already be in the desired sort order; the first row seen for a
    key becomes the representative and the rest are folded in as extra sources.
    """
    groups: dict[str, dict] = {}
    order: list[str] = []
    for doc in docs:
        key = doc.get("dedupeKey") or doc["id"]
        ref = {
            "source": doc.get("source"),
            "boardToken": doc.get("boardToken"),
            "url": doc.get("url"),
        }
        if key not in groups:
            doc["duplicateCount"] = 1
            doc["sources"] = [ref]
            groups[key] = doc
            order.append(key)
        else:
            rep = groups[key]
            rep["duplicateCount"] += 1
            rep["sources"].append(ref)

    grouped = [groups[k] for k in order]
    total = len(grouped)
    start = (page - 1) * page_size
    return grouped[start : start + page_size], total


def list_jobs(
    db,
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
    collapse: bool = True,
    q: str | None = None,
    company: str | None = None,
    location: str | None = None,
    employment_type: str | None = None,
    source: str | None = None,
    salary_min: int | None = None,
    experience_level: str | None = None,
    requires_degree: bool | None = None,
    sponsorship_available: bool | None = None,
    clearance_required: bool | None = None,
    max_age_days: int | None = None,
    min_quality: int | None = None,
    preferred_companies: list[str] | None = None,
    hidden_companies: list[str] | None = None,
    hidden_employment_types: list[str] | None = None,
    preferred_only: bool = False,
) -> dict:
    query = _build_query(
        q=q,
        company=company,
        location=location,
        employment_type=employment_type,
        source=source,
        salary_min=salary_min,
        experience_level=experience_level,
        requires_degree=requires_degree,
        sponsorship_available=sponsorship_available,
        clearance_required=clearance_required,
        max_age_days=max_age_days,
        min_quality=min_quality,
        preferred_companies=preferred_companies,
        hidden_companies=hidden_companies,
        hidden_employment_types=hidden_employment_types,
        preferred_only=preferred_only,
    )
    if sort_by not in set(SORTABLE_FIELDS):
        sort_by = "postedAt"

    if not collapse:
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

    # Collapse duplicates across boards/sources into one clean listing.
    sort_direction = 1 if sort_order == "asc" else -1
    cursor = (
        db.discovered_jobs.find(query)
        .sort(sort_by, sort_direction)
        .limit(COLLAPSE_SCAN_CAP)
    )
    docs = [_serialize(doc) for doc in cursor]
    items, total = _collapse(docs, page, page_size)
    total_pages = (total + page_size - 1) // page_size
    return {
        "items": items,
        "meta": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": total_pages,
        },
    }
