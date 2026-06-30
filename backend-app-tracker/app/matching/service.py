"""Orchestration for résumé ↔ job matching.

Ties the pure engine (extraction, keywords, scoring) to the app's data: résumés
live in GridFS (ownership-stamped) and job text may need to be scraped from a
URL. Every function returns plain dicts shaped for the response schemas.
"""

from __future__ import annotations

from fastapi import status

from app.common.errors import raise_error
from app.matching import keywords, scoring
from app.matching.extract import extract_resume_text, html_to_text
from app.matching.fetch import FetchError, fetch_url
from app.resumes.service import get_resume_file


def _resume_text_from_id(db, resume_id: str, user_id: str) -> str:
    """Load an uploaded résumé (ownership enforced) and extract its text."""
    file = get_resume_file(db, resume_id, user_id)
    text = extract_resume_text(
        file.read(), content_type=file.content_type, filename=file.filename
    )
    if not text:
        raise_error(
            code="RESUME_UNREADABLE",
            message="Could not extract text from this résumé file",
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return text


def _job_text_from_url(url: str) -> tuple[str, str]:
    """Scrape a posting URL → (visible_text, title). Maps fetch errors to 400."""
    try:
        html = fetch_url(url)
    except FetchError as exc:
        raise_error(
            code="JOB_FETCH_FAILED",
            message=str(exc),
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    text, title = html_to_text(html)
    if not text:
        raise_error(
            code="JOB_FETCH_EMPTY",
            message="No readable job text was found at that URL",
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return text, title


def scrape_job(url: str) -> dict:
    """Fetch a posting and return its title plus extracted skills/keywords."""
    text, title = _job_text_from_url(url)
    prof = keywords.profile(text)
    return {
        "title": title,
        "textLength": len(text),
        "skills": prof.skills,
        "keywords": prof.keywords,
    }


def score(db, payload, user_id: str) -> dict:
    """Resolve résumé + job text from the request and compute a match score."""
    if payload.resumeText:
        resume_text = payload.resumeText
    else:
        resume_text = _resume_text_from_id(db, payload.resumeId, user_id)

    if payload.jobDescription:
        job_text = payload.jobDescription
    else:
        job_text, _ = _job_text_from_url(str(payload.jobUrl))

    result = scoring.score_match(resume_text, job_text)
    b = result.breakdown
    return {
        "score": result.score,
        "breakdown": {
            "skillCoverage": b.skill_coverage,
            "keywordCoverage": b.keyword_coverage,
            "matchedSkills": b.matched_skills,
            "missingSkills": b.missing_skills,
            "matchedKeywords": b.matched_keywords,
            "missingKeywords": b.missing_keywords,
        },
        "gaps": result.gaps,
        "resume": {
            "skills": result.resume_profile.skills,
            "keywords": result.resume_profile.keywords,
        },
        "job": {
            "skills": result.job_profile.skills,
            "keywords": result.job_profile.keywords,
        },
    }
