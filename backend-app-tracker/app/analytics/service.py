from statistics import mean, median

from pymongo.collection import Collection

# The pipeline statuses, in funnel order. Kept here so every analytic agrees on
# the set of known statuses and their ordering.
STATUSES = ("applied", "interviewing", "offer", "rejected")


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
# Richer analytics (FEAT-7)
#
# These metrics need per-job dates and combinations the simple $group above
# can't express portably, so they fetch the user's jobs (a per-user, modest set)
# and compute in Python. This keeps the logic readable and free of date-operator
# quirks across Mongo / the mongomock test backend.
# ---------------------------------------------------------------------------

def _rate(part: int, whole: int) -> float:
    """A 0..1 ratio rounded to 4 dp; 0.0 when there's nothing to divide."""
    return round(part / whole, 4) if whole else 0.0


def get_funnel(jobs: Collection, user_id: str) -> dict:
    """Status counts plus headline conversion rates."""
    counts = get_job_status_counts(jobs, user_id)
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


def get_applications_over_time(jobs: Collection, user_id: str) -> dict:
    """Applications grouped by calendar month (by ``createdAt``), ascending."""
    cursor = jobs.find({"userId": user_id}, {"createdAt": 1})

    buckets: dict[str, int] = {}
    for job in cursor:
        created = job.get("createdAt")
        if created is None:
            continue
        period = created.strftime("%Y-%m")
        buckets[period] = buckets.get(period, 0) + 1

    points = [
        {"period": period, "count": buckets[period]} for period in sorted(buckets)
    ]
    return {"interval": "month", "points": points}


def get_time_to_offer(jobs: Collection, user_id: str) -> dict:
    """Average/median days from application to offer.

    Approximation: an offer's ``updatedAt`` stands in for when the offer landed
    (the schema has no per-status timestamps), measured from ``createdAt``.
    """
    cursor = jobs.find(
        {"userId": user_id, "status": "offer"},
        {"createdAt": 1, "updatedAt": 1},
    )

    durations = []
    for job in cursor:
        created = job.get("createdAt")
        updated = job.get("updatedAt")
        if created is None or updated is None:
            continue
        days = (updated - created).total_seconds() / 86400
        if days >= 0:
            durations.append(days)

    if not durations:
        return {"offers": 0, "averageDays": None, "medianDays": None}

    return {
        "offers": len(durations),
        "averageDays": round(mean(durations), 2),
        "medianDays": round(median(durations), 2),
    }


def get_company_funnels(jobs: Collection, user_id: str) -> dict:
    """Per-company status breakdown, busiest companies first."""
    cursor = jobs.find({"userId": user_id}, {"company": 1, "status": 1})

    by_company: dict[str, dict] = {}
    for job in cursor:
        company = job.get("company") or "(unknown)"
        row = by_company.setdefault(
            company, {"company": company, **_empty_status_counts(), "total": 0}
        )
        status = job.get("status")
        if status in row:
            row[status] += 1
        row["total"] += 1

    companies = sorted(
        by_company.values(), key=lambda r: (-r["total"], r["company"])
    )
    return {"companies": companies}