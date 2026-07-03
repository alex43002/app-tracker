"""Email tracking service: classify an email and match it to tracked jobs."""

from __future__ import annotations

from pymongo.database import Database

from app.email_tracking.classifier import classify_email

MAX_MATCHES = 10


def _serialize_match(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "jobTitle": doc.get("jobTitle", ""),
        "company": doc.get("company", ""),
        "status": doc.get("status", ""),
    }


def match_jobs(db: Database, user_id: str, text: str) -> list[dict]:
    """The user's tracked jobs whose company name appears in the email text.

    A simple, explainable substring match (case-insensitive) — the email likely
    names the company, so we surface those jobs for the user to confirm before
    applying a status change.
    """
    haystack = (text or "").casefold()
    cursor = db.jobs.find(
        {"userId": user_id}, {"jobTitle": 1, "company": 1, "status": 1}
    )
    matches = []
    for doc in cursor:
        company = (doc.get("company") or "").strip()
        if company and company.casefold() in haystack:
            matches.append(_serialize_match(doc))
            if len(matches) >= MAX_MATCHES:
                break
    return matches


def analyze(db: Database, user_id: str, text: str, subject: str | None) -> dict:
    """Classify an email and attach the tracked jobs it most likely refers to."""
    result = classify_email(text, subject)
    result["matchedJobs"] = match_jobs(db, user_id, text)
    return result
