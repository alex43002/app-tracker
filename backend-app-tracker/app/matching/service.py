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
from app.jobs.service import read_validated_resume
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


def extract_resume_upload(upload) -> dict:
    """Extract text (and a skill/keyword profile) from an ad-hoc résumé upload.

    Used by Match to score a file the user hasn't saved to a job. The returned
    ``text`` is handed back to the client, which replays it as ``resumeText``
    when scoring — nothing is persisted.
    """
    data = read_validated_resume(upload)
    text = extract_resume_text(
        data, content_type=upload.content_type, filename=upload.filename
    )
    if not text:
        raise_error(
            code="RESUME_UNREADABLE",
            message="Could not extract text from this résumé file",
            http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    prof = keywords.profile(text)
    return {
        "filename": upload.filename or "",
        "textLength": len(text),
        "skills": prof.skills,
        "keywords": prof.keywords,
        "text": text,
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

    def _term(m) -> dict:
        return {
            "term": m.term,
            "status": m.status,
            "bucket": m.bucket,
            "isConcept": m.is_concept,
            "evidence": m.evidence,
            "category": m.category,
        }

    c = result.coverage
    return {
        "score": result.score,
        "confidence": result.confidence,
        "confidenceReason": result.confidence_reason,
        "skillSignalAvailable": result.skill_signal_available,
        "roleFamilies": result.role_families,
        "coverage": {
            "required": c.required,
            "responsibility": c.responsibility,
            "preferred": c.preferred,
            "concept": c.concept,
            "keyword": c.keyword,
        },
        "strengths": [_term(m) for m in result.strengths],
        "gaps": [_term(m) for m in result.gaps],
        "resume": {
            "skills": result.resume_profile.skills,
            "keywords": result.resume_profile.keywords,
        },
        "job": {
            "skills": result.job_profile.skills,
            "keywords": result.job_profile.keywords,
        },
    }
