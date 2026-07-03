from datetime import datetime
from statistics import mean, median

from pymongo.collection import Collection

from app.analytics.sources import source_from_url

# The pipeline statuses, in funnel order. Kept here so every analytic agrees on
# the set of known statuses and their ordering.
STATUSES = ("applied", "interviewing", "offer", "rejected")

# Supported bucket intervals for applications-over-time (FEAT-13).
INTERVALS = ("week", "month", "quarter")
DEFAULT_INTERVAL = "month"


def _empty_status_counts() -> dict:
    return {s: 0 for s in STATUSES}


def get_job_status_counts(jobs: Collection, user_id: str) -> dict:
    pipeline = [
        {"$match": {"userId": user_id}},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
            }
        },
    ]

    results = jobs.aggregate(pipeline)

    counts = {**_empty_status_counts(), "total": 0}
    total = 0

    for row in results:
        status = row["_id"]
        count = row["count"]
        total += count

        if status in counts:
            counts[status] = count

    counts["total"] = total
    return counts


# ---------------------------------------------------------------------------
# Richer analytics (FEAT-7 / FEAT-13)
#
# These metrics need per-job dates and combinations the simple $group above
# can't express portably, so they fetch the user's jobs (a per-user, modest set)
# and compute in Python. This keeps the logic readable and free of date-operator
# quirks across Mongo / the mongomock test backend. The pure ``*_from`` helpers
# operate on an already-fetched list so the combined ``get_summary`` (CLN-13)
# can compute every metric from a single query.
# ---------------------------------------------------------------------------

# Fields every analytic needs; keep the projection tight so the per-user fetch
# stays cheap.
_ANALYTICS_PROJECTION = {
    "status": 1,
    "company": 1,
    "createdAt": 1,
    "updatedAt": 1,
    "statusHistory": 1,
}


def _rate(part: int, whole: int) -> float:
    """A 0..1 ratio rounded to 4 dp; 0.0 when there's nothing to divide."""
    return round(part / whole, 4) if whole else 0.0


def _normalize_interval(interval: str | None) -> str:
    return interval if interval in INTERVALS else DEFAULT_INTERVAL


def _bucket_key(dt: datetime, interval: str) -> str:
    """A sortable period label for ``dt`` at the requested granularity."""
    if interval == "week":
        # ISO year + week, e.g. "2026-W26"; sorts chronologically as text.
        iso = dt.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    if interval == "quarter":
        return f"{dt.year}-Q{(dt.month - 1) // 3 + 1}"
    return dt.strftime("%Y-%m")  # month (default)


def _status_reached_at(job: dict, status: str) -> datetime | None:
    """When a job first reached ``status`` per its history, or ``None``.

    Falls back to ``updatedAt`` for legacy jobs written before FEAT-13 added the
    ``statusHistory`` timeline (only when the job currently holds that status).
    """
    history = job.get("statusHistory")
    if history:
        for entry in history:
            if entry.get("status") == status:
                return entry.get("at")
        return None
    return job.get("updatedAt") if job.get("status") == status else None


# ---- pure, list-based metric helpers ----


def _status_counts_from(jobs_list: list[dict]) -> dict:
    counts = {**_empty_status_counts(), "total": 0}
    for job in jobs_list:
        counts["total"] += 1
        status = job.get("status")
        if status in STATUSES:
            counts[status] += 1
    return counts


def _funnel_from(jobs_list: list[dict]) -> dict:
    counts = _status_counts_from(jobs_list)
    total = counts["total"]
    interviewing, offer = counts["interviewing"], counts["offer"]
    return {
        **counts,
        # "Responded" = anything that moved past the initial application.
        "responseRate": _rate(total - counts["applied"], total),
        # Reached an interview or beyond.
        "interviewRate": _rate(interviewing + offer, total),
        "offerRate": _rate(offer, total),
    }


def _applications_over_time_from(jobs_list: list[dict], interval: str) -> dict:
    interval = _normalize_interval(interval)
    buckets: dict[str, int] = {}
    for job in jobs_list:
        created = job.get("createdAt")
        if created is None:
            continue
        period = _bucket_key(created, interval)
        buckets[period] = buckets.get(period, 0) + 1

    points = [
        {"period": period, "count": buckets[period]} for period in sorted(buckets)
    ]
    return {"interval": interval, "points": points}


def _time_to_offer_from(jobs_list: list[dict]) -> dict:
    durations = []
    for job in jobs_list:
        if job.get("status") != "offer":
            continue
        created = job.get("createdAt")
        offer_at = _status_reached_at(job, "offer")
        if created is None or offer_at is None:
            continue
        days = (offer_at - created).total_seconds() / 86400
        if days >= 0:
            durations.append(days)

    if not durations:
        return {"offers": 0, "averageDays": None, "medianDays": None}

    return {
        "offers": len(durations),
        "averageDays": round(mean(durations), 2),
        "medianDays": round(median(durations), 2),
    }


def _company_funnels_from(jobs_list: list[dict]) -> dict:
    by_company: dict[str, dict] = {}
    for job in jobs_list:
        company = job.get("company") or "(unknown)"
        row = by_company.setdefault(
            company, {"company": company, **_empty_status_counts(), "total": 0}
        )
        status = job.get("status")
        if status in STATUSES:
            row[status] += 1
        row["total"] += 1

    companies = sorted(
        by_company.values(), key=lambda r: (-r["total"], r["company"])
    )
    return {"companies": companies}


def _source_performance_from(jobs_list: list[dict]) -> dict:
    """Funnel + conversion rates grouped by the channel each job came from.

    The source is derived from the job URL host (job boards / ATS platforms get
    friendly names; other sites fall back to their domain), so users can see
    which channels actually produce interviews and offers.
    """
    by_source: dict[str, dict] = {}
    for job in jobs_list:
        source = source_from_url(job.get("url"))
        row = by_source.setdefault(
            source, {"source": source, **_empty_status_counts(), "total": 0}
        )
        status = job.get("status")
        if status in STATUSES:
            row[status] += 1
        row["total"] += 1

    sources = []
    for row in by_source.values():
        total = row["total"]
        row["responseRate"] = _rate(total - row["applied"], total)
        row["interviewRate"] = _rate(row["interviewing"] + row["offer"], total)
        row["offerRate"] = _rate(row["offer"], total)
        sources.append(row)

    # Busiest channels first; break ties by offer rate then name.
    sources.sort(key=lambda r: (-r["total"], -r["offerRate"], r["source"]))
    return {"sources": sources}


# ---- per-endpoint wrappers (each does its own fetch) ----


def get_funnel(jobs: Collection, user_id: str) -> dict:
    """Status counts plus headline conversion rates."""
    return _funnel_from(list(jobs.find({"userId": user_id}, {"status": 1})))


def get_applications_over_time(
    jobs: Collection, user_id: str, interval: str = DEFAULT_INTERVAL
) -> dict:
    """Applications bucketed by ``interval`` (week/month/quarter), ascending."""
    cursor = jobs.find({"userId": user_id}, {"createdAt": 1})
    return _applications_over_time_from(list(cursor), interval)


def get_time_to_offer(jobs: Collection, user_id: str) -> dict:
    """Average/median days from application to offer, using the status timeline
    (FEAT-13) — exact when history is present, falling back to ``updatedAt`` for
    legacy jobs."""
    cursor = jobs.find(
        {"userId": user_id, "status": "offer"},
        {"status": 1, "createdAt": 1, "updatedAt": 1, "statusHistory": 1},
    )
    return _time_to_offer_from(list(cursor))


def get_company_funnels(jobs: Collection, user_id: str) -> dict:
    """Per-company status breakdown, busiest companies first."""
    cursor = jobs.find({"userId": user_id}, {"company": 1, "status": 1})
    return _company_funnels_from(list(cursor))


def get_source_performance(jobs: Collection, user_id: str) -> dict:
    """Per-source funnel + conversion rates (which channels produce results)."""
    cursor = jobs.find({"userId": user_id}, {"url": 1, "status": 1})
    return _source_performance_from(list(cursor))


def get_summary(
    jobs: Collection, user_id: str, interval: str = DEFAULT_INTERVAL
) -> dict:
    """All headline analytics from a single per-user fetch (CLN-13)."""
    jobs_list = list(jobs.find({"userId": user_id}, _ANALYTICS_PROJECTION))
    return {
        "funnel": _funnel_from(jobs_list),
        "applicationsOverTime": _applications_over_time_from(jobs_list, interval),
        "timeToOffer": _time_to_offer_from(jobs_list),
        "byCompany": _company_funnels_from(jobs_list),
    }
