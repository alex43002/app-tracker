"""Company research snapshots derived from ingested public postings.

A snapshot is assembled entirely from the ``discovered_jobs`` we already
ingest (FEAT-22) — no scraping, no external news/Glassdoor APIs, no generative
AI. It surfaces what we can legitimately infer from a company's own postings:
how many roles are open, where, on which ATS platforms, the seniority mix, the
salary range, and tech-stack clues pulled from the job text via the matching
engine's skill taxonomy (FEAT-21).
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime

from app.matching.keywords import extract_skills

# Cap how many postings we scan per company so the aggregation stays bounded.
SNAPSHOT_SCAN_CAP = 500
TOP_FACETS = 8
TOP_SKILLS = 12
SAMPLE_TITLES = 8


def _facets(values: list[str | None]) -> list[dict]:
    counts = Counter(v for v in values if v)
    return [
        {"value": value, "count": count}
        for value, count in counts.most_common(TOP_FACETS)
    ]


def list_companies(db, q: str | None = None, limit: int = 50) -> dict:
    """Distinct companies present in discovered postings, with role counts."""
    rows = db.discovered_jobs.aggregate(
        [{"$group": {"_id": "$company", "count": {"$sum": 1}}}]
    )
    companies = [
        {"name": str(r["_id"]), "openRoles": int(r.get("count", 0) or 0)}
        for r in rows
        if r.get("_id")
    ]
    if q and q.strip():
        needle = q.strip().casefold()
        companies = [c for c in companies if needle in c["name"].casefold()]
    companies.sort(key=lambda c: (-c["openRoles"], c["name"].casefold()))
    return {"companies": companies[: max(1, min(limit, 200))]}


def snapshot(db, company: str) -> dict:
    """Aggregate a research snapshot for ``company`` from its postings."""
    pattern = {"$regex": re.escape(company.strip()), "$options": "i"}
    cursor = db.discovered_jobs.find({"company": pattern}).limit(SNAPSHOT_SCAN_CAP)
    docs = list(cursor)

    if not docs:
        return {
            "company": company.strip(),
            "found": False,
            "openRoles": 0,
            "sources": [],
            "locations": [],
            "employmentTypes": [],
            "experienceLevels": [],
            "workArrangements": [],
            "topSkills": [],
            "sampleTitles": [],
            "salaryMin": None,
            "salaryMax": None,
            "latestPostedAt": None,
        }

    # Canonical display name: the most common exact spelling among matches.
    name = Counter(d.get("company", company) for d in docs).most_common(1)[0][0]

    skill_counts: Counter[str] = Counter()
    salary_mins: list[int] = []
    salary_maxs: list[int] = []
    posted: list[datetime] = []
    for doc in docs:
        for skill in extract_skills(doc.get("description") or ""):
            skill_counts[skill] += 1
        if doc.get("salaryMin") is not None:
            salary_mins.append(doc["salaryMin"])
        if doc.get("salaryMax") is not None:
            salary_maxs.append(doc["salaryMax"])
        if doc.get("postedAt") is not None:
            posted.append(doc["postedAt"])

    return {
        "company": name,
        "found": True,
        "openRoles": len(docs),
        "sources": sorted({d.get("source") for d in docs if d.get("source")}),
        "locations": _facets([d.get("location") for d in docs]),
        "employmentTypes": _facets([d.get("employmentType") for d in docs]),
        "experienceLevels": _facets([d.get("experienceLevel") for d in docs]),
        "workArrangements": _facets([d.get("workArrangement") for d in docs]),
        "topSkills": [
            {"value": skill, "count": count}
            for skill, count in skill_counts.most_common(TOP_SKILLS)
        ],
        "sampleTitles": [d["title"] for d in docs[:SAMPLE_TITLES] if d.get("title")],
        "salaryMin": min(salary_mins) if salary_mins else None,
        "salaryMax": max(salary_maxs) if salary_maxs else None,
        "latestPostedAt": max(posted) if posted else None,
    }
