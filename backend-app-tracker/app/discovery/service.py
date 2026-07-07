"""Discovery service: ingest normalized postings and serve filtered queries.

Postings live in a shared ``discovered_jobs`` collection keyed by
``(source, sourceId)`` so re-ingesting a board updates existing rows instead of
duplicating them. Listing is global (postings are public) but auth-gated.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
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

# Sentinel a client can pass as the location filter to match postings that have
# no location listed (FEAT-30: guided location filter).
NO_LOCATION = "__no_location__"

# Hard cap on how many distinct locations the guided picker will surface.
LOCATION_FACET_CAP = 200


@dataclass
class DiscoveryFilters:
    """Every filterable dimension of the discovered-jobs feed.

    Carried as one object through the route → ``list_jobs`` → ``_build_query``
    path so the ~14-field list isn't spelled out (and forwarded by hand) at each
    layer. Field names are the snake_case keys the saved-alert ``CRITERIA_FIELDS``
    map already targets.
    """

    q: str | None = None
    company: str | None = None
    location: str | None = None
    work_arrangement: str | None = None
    employment_type: str | None = None
    source: str | None = None
    salary_min: int | None = None
    experience_level: str | None = None
    requires_degree: bool | None = None
    sponsorship_available: bool | None = None
    clearance_required: bool | None = None
    max_age_days: int | None = None
    min_quality: int | None = None
    # Preference overlay (applied only when no explicit company/type filter wins).
    preferred_companies: list[str] | None = None
    hidden_companies: list[str] | None = None
    hidden_employment_types: list[str] | None = None
    preferred_only: bool = False


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


def _normalize_location(value: str) -> str:
    """Collapse whitespace and trim so case/spacing variants merge (FEAT-30)."""
    return re.sub(r"\s+", " ", value).strip()


def location_facets(db, *, q: str | None = None, limit: int = 50) -> dict:
    """Distinct, normalized locations present in discovered postings (FEAT-30).

    Powers the guided location filter: rather than typing free-form text that
    rarely matches a posting's exact location string, the client offers the
    locations that actually exist. Case/whitespace variants collapse into one
    canonical option (the most-seen spelling wins), results are ranked by how
    many postings use them, and the count of postings with no location is
    reported separately so the picker can offer a "No location listed" choice.
    """
    rows = db.discovered_jobs.aggregate(
        [{"$group": {"_id": "$location", "count": {"$sum": 1}}}]
    )

    no_location = 0
    merged: dict[str, dict] = {}
    for row in rows:
        raw = row.get("_id")
        count = int(row.get("count", 0) or 0)
        if raw is None or not str(raw).strip():
            no_location += count
            continue
        display = _normalize_location(str(raw))
        key = display.casefold()
        entry = merged.get(key)
        if entry is None:
            merged[key] = {"value": display, "count": count}
        else:
            entry["count"] += count
            # Keep the spelling used by the most postings as the display value.
            if count > entry["_top"]:
                entry["value"] = display
        merged[key]["_top"] = max(count, merged[key].get("_top", 0))

    options = list(merged.values())
    if q and q.strip():
        needle = q.strip().casefold()
        options = [o for o in options if needle in o["value"].casefold()]
    options.sort(key=lambda o: (-o["count"], o["value"].casefold()))

    capped = max(1, min(limit, LOCATION_FACET_CAP))
    options = [{"value": o["value"], "count": o["count"]} for o in options[:capped]]
    return {"locations": options, "noLocationCount": no_location}


# String filters that map to an exact match on a field (skipped when blank).
_STR_EQUALITY_FILTERS = {
    "work_arrangement": "workArrangement",
    "source": "source",
    "experience_level": "experienceLevel",
}
# Tri-state boolean filters (False is meaningful, so only None is skipped).
_BOOL_EQUALITY_FILTERS = {
    "requires_degree": "requiresDegree",
    "sponsorship_available": "sponsorshipAvailable",
    "clearance_required": "clearanceRequired",
}


def _company_clause(f: DiscoveryFilters):
    """Company match: an explicit search wins; else apply the user's preferences
    (preferred-only, then hide-list). Returns None when unconstrained."""
    if f.company:
        return _escape_regex(f.company)
    if f.preferred_only and f.preferred_companies:
        return {"$in": f.preferred_companies}
    if f.hidden_companies:
        return {"$nin": f.hidden_companies}
    return None


def _employment_type_clause(f: DiscoveryFilters):
    """Employment type: an explicit filter wins; else drop hidden types."""
    if f.employment_type:
        return f.employment_type
    if f.hidden_employment_types:
        return {"$nin": f.hidden_employment_types}
    return None


def _build_query(f: DiscoveryFilters) -> dict:
    """Build a safe Mongo filter — every operator is server-constructed."""
    query: dict = {}
    if f.q:
        query["title"] = _escape_regex(f.q)

    if f.location == NO_LOCATION:
        # Postings with no location listed (FEAT-30).
        query["$or"] = [
            {"location": {"$in": [None, ""]}},
            {"location": {"$exists": False}},
        ]
    elif f.location:
        query["location"] = _escape_regex(f.location)

    for attr, field in _STR_EQUALITY_FILTERS.items():
        value = getattr(f, attr)
        if value:
            query[field] = value
    for attr, field in _BOOL_EQUALITY_FILTERS.items():
        value = getattr(f, attr)
        if value is not None:
            query[field] = value

    if f.salary_min is not None:
        # A posting qualifies if the top of its range meets the floor.
        query["salaryMax"] = {"$gte": f.salary_min}
    if f.max_age_days is not None:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=f.max_age_days)
        query["postedAt"] = {"$gte": cutoff}
    if f.min_quality is not None:
        query["qualityScore"] = {"$gte": f.min_quality}

    company = _company_clause(f)
    if company is not None:
        query["company"] = company
    employment_type = _employment_type_clause(f)
    if employment_type is not None:
        query["employmentType"] = employment_type

    return query


# Discovery filter criteria (camelCase, as the client sends them) → the
# matching ``DiscoveryFilters`` field. Used by saved job alerts to reuse the
# exact same filtering as the live Discover query.
CRITERIA_FIELDS = {
    "q": "q",
    "company": "company",
    "location": "location",
    "workArrangement": "work_arrangement",
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
    kwargs = {CRITERIA_FIELDS[key]: value for key, value in clean_criteria(criteria).items()}
    return _build_query(DiscoveryFilters(**kwargs))


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
    filters: DiscoveryFilters,
    *,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
    collapse: bool = True,
) -> dict:
    query = _build_query(filters)
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
