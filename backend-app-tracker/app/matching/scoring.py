"""Score a résumé against a job description — explainable and domain-agnostic.

The posting is decomposed into weighted, bucketed terms (see ``analyze.py``):
each term is a recognized concept *or* a salient keyphrase, tagged as coming
from required / responsibility / preferred sections. Each term is then matched
against the résumé at one of four confidence levels — **strong** (direct hit),
**partial** (adjacent/related evidence or the words present but not as a
phrase), **foundational** (conceptual-tier coverage in the same area) or
**missing** — and every non-miss carries the résumé evidence that earned it.

The final score is a weighted blend of per-bucket coverage, renormalized over
whichever buckets the posting actually has. Two honesty rules the old engine
violated:

* If *no* terms could be extracted, we do **not** invent 100% coverage — the
  result is flagged low-confidence and falls back to a clearly-labelled
  keyword-only estimate.
* "Concept coverage" (the curated-skill signal) is reported as **N/A**, not
  100%, when the posting yielded no recognized concepts.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.matching import analyze, keywords
from app.matching.taxonomy import CONCEPT_BY_ID, TIER_FOUNDATIONAL, related_ids

STATUS_STRONG = "strong"
STATUS_PARTIAL = "partial"
STATUS_FOUNDATIONAL = "foundational"
STATUS_MISSING = "missing"

_STATUS_FACTOR = {
    STATUS_STRONG: 1.0,
    STATUS_PARTIAL: 0.6,
    STATUS_FOUNDATIONAL: 0.4,
    STATUS_MISSING: 0.0,
}

BUCKET_REQUIRED = "required"
BUCKET_RESPONSIBILITY = "responsibility"
BUCKET_PREFERRED = "preferred"
_BUCKET_BASE = {
    BUCKET_REQUIRED: 0.5,
    BUCKET_RESPONSIBILITY: 0.3,
    # Nice-to-haves weigh less (0.20 → 0.15) so an all-miss preferred list —
    # common when scraped chrome inflates it — no longer tanks the score.
    BUCKET_PREFERRED: 0.15,
}

CONFIDENCE_HIGH = "high"
CONFIDENCE_MEDIUM = "medium"
CONFIDENCE_LOW = "low"

# Contamination = how much scraped page-chrome leaked into the scored terms.
# Thresholds on the residual noise rate (see keywords.noise_rate). A high level
# means required "gaps" may be artifacts, so the score is only approximate.
CONTAMINATION_LOW = "low"
CONTAMINATION_MEDIUM = "medium"
CONTAMINATION_HIGH = "high"
_CONTAMINATION_MEDIUM_MIN = 0.15
_CONTAMINATION_HIGH_MIN = 0.30


def _contamination(noise_rate: float) -> str:
    if noise_rate >= _CONTAMINATION_HIGH_MIN:
        return CONTAMINATION_HIGH
    if noise_rate >= _CONTAMINATION_MEDIUM_MIN:
        return CONTAMINATION_MEDIUM
    return CONTAMINATION_LOW


@dataclass(frozen=True)
class TermMatch:
    term: str
    status: str
    bucket: str
    is_concept: bool
    weight: float
    evidence: list[str]
    category: str | None = None


@dataclass(frozen=True)
class Coverage:
    required: float | None
    responsibility: float | None
    preferred: float | None
    concept: float | None  # curated-skill signal; None when no concepts detected
    keyword: float  # legacy general keyword overlap (always available)


@dataclass(frozen=True)
class MatchResult:
    score: int
    confidence: str
    confidence_reason: str
    skill_signal_available: bool
    contamination: str  # low | medium | high — scraped-chrome leakage level
    role_families: list[str]
    coverage: Coverage
    strengths: list[TermMatch]  # strong / partial / foundational, best first
    gaps: list[TermMatch]  # missing, most important first
    resume_profile: keywords.TermProfile
    job_profile: keywords.TermProfile


def _match_term(term: analyze.JobTerm, resume: analyze.ResumeAnalysis) -> tuple[str, list[str]]:
    """Classify a single job term against the résumé and return its evidence."""
    if term.is_concept:
        if term.key in resume.concept_ids:
            return STATUS_STRONG, list(resume.concept_evidence.get(term.key, []))
        related = related_ids(term.key) & resume.concept_ids
        if related:
            evidence: list[str] = []
            for cid in related:
                evidence.extend(resume.concept_evidence.get(cid, []))
            return STATUS_PARTIAL, evidence[:4]
        if term.tier == TIER_FOUNDATIONAL:
            same_area = [
                cid
                for cid in resume.concept_ids
                if CONCEPT_BY_ID[cid].category == term.category
            ]
            if same_area:
                evidence = []
                for cid in same_area:
                    evidence.extend(resume.concept_evidence.get(cid, []))
                return STATUS_FOUNDATIONAL, evidence[:4]
        return STATUS_MISSING, []

    # Generic keyphrase term.
    if term.key in resume.ngrams:
        return STATUS_STRONG, [term.display]
    words = term.key.split(" ")
    if len(words) > 1 and all(w in resume.unigrams for w in words):
        return STATUS_PARTIAL, [term.display]
    return STATUS_MISSING, []


def _bucket_of(term: analyze.JobTerm) -> str:
    if term.required:
        return BUCKET_REQUIRED
    if term.preferred:
        return BUCKET_PREFERRED
    return BUCKET_RESPONSIBILITY


def _coverage(matches: list[TermMatch], bucket: str) -> float | None:
    """Weighted coverage of one bucket, or None when the bucket is empty."""
    items = [m for m in matches if m.bucket == bucket]
    total = sum(m.weight for m in items)
    if total == 0:
        return None
    earned = sum(m.weight * _STATUS_FACTOR[m.status] for m in items)
    return round(earned / total, 4)


def _keyword_coverage(
    job_skills: list[str],
    job_ranked: list[tuple[str, int]],
    resume_text: str,
    resume_skills: list[str],
) -> float:
    """Legacy general keyword overlap (stemmed), kept as a stable fallback.

    Takes the job's already-extracted skills + ranked keywords (so the job text
    isn't tokenized again here) and the résumé's skills (so its vocabulary skips
    a second skill extraction). Behaviour is identical to profiling the job at
    the default limit and folding the résumé vocabulary as before.
    """
    job_keywords = keywords.build_profile(job_skills, job_ranked).keywords
    if not job_keywords:
        return 0.0
    resume_vocab = keywords.vocabulary(resume_text, skills=resume_skills)
    matched = sum(
        1
        for kw in job_keywords
        if kw in resume_vocab or keywords.stem_term(kw) in resume_vocab
    )
    return round(matched / len(job_keywords), 4)


def _confidence(
    n_terms: int, has_required_or_resp: bool, skill_signal: bool, contamination: str
) -> tuple[str, str]:
    if n_terms == 0:
        return (
            CONFIDENCE_LOW,
            "Could not extract role requirements from this posting; showing a "
            "keyword-only estimate.",
        )
    if n_terms >= 8 and has_required_or_resp:
        level = CONFIDENCE_HIGH
    elif n_terms >= 3:
        level = CONFIDENCE_MEDIUM
    else:
        level = CONFIDENCE_LOW
    reason = f"Parsed {n_terms} requirement terms from the posting."
    if not skill_signal:
        reason += " Matched on salient terms (no curated skills recognized for this field)."
    # Heavy scraped-page noise means some "gaps" may be page chrome, not real
    # requirements — never claim high confidence in that case.
    if contamination == CONTAMINATION_HIGH:
        if level == CONFIDENCE_HIGH:
            level = CONFIDENCE_MEDIUM
        reason += (
            " Some page navigation/footer text may have leaked in, so the score"
            " is approximate."
        )
    return level, reason


def score_match(resume_text: str, job_text: str, *, keyword_limit: int = 25) -> MatchResult:
    """Compare a résumé to a job description and return an explainable result."""
    job = analyze.analyze_job(job_text)
    resume = analyze.analyze_resume(resume_text)

    # Tokenize each text once for the keyword signals (AUD-16): the skills list
    # and the full ranked-keyword list are extracted a single time per text and
    # reused for keyword coverage and both term profiles below, rather than being
    # recomputed inside every `profile()` call (the résumé and job were each
    # tokenized for keywords twice before, at different limits).
    job_skills = keywords.extract_skills(job_text)
    job_ranked = keywords.ranked_keywords(job_text)
    resume_skills = keywords.extract_skills(resume_text)
    resume_ranked = keywords.ranked_keywords(resume_text)

    keyword_cov = _keyword_coverage(job_skills, job_ranked, resume_text, resume_skills)

    resume_profile = keywords.build_profile(
        resume_skills, resume_ranked, keyword_limit=keyword_limit * 2
    )
    job_profile = keywords.build_profile(
        job_skills, job_ranked, keyword_limit=keyword_limit
    )

    matches: list[TermMatch] = []
    for term in job.terms:
        status, evidence = _match_term(term, resume)
        matches.append(
            TermMatch(
                term=term.display,
                status=status,
                bucket=_bucket_of(term),
                is_concept=term.is_concept,
                weight=term.weight,
                evidence=evidence,
                category=term.category,
            )
        )

    cov_required = _coverage(matches, BUCKET_REQUIRED)
    cov_resp = _coverage(matches, BUCKET_RESPONSIBILITY)
    cov_pref = _coverage(matches, BUCKET_PREFERRED)

    concept_matches = [m for m in matches if m.is_concept]
    concept_total = sum(m.weight for m in concept_matches)
    concept_cov = (
        round(
            sum(m.weight * _STATUS_FACTOR[m.status] for m in concept_matches) / concept_total,
            4,
        )
        if concept_total
        else None
    )

    skill_signal = bool(concept_matches)
    has_req_or_resp = cov_required is not None or cov_resp is not None
    contamination = _contamination(job.noise_rate)
    confidence, reason = _confidence(
        len(matches), has_req_or_resp, skill_signal, contamination
    )

    if not matches:
        # Nothing structured extracted — do NOT fake coverage; keyword-only.
        score = round(keyword_cov * 100)
    else:
        present = {
            BUCKET_REQUIRED: cov_required,
            BUCKET_RESPONSIBILITY: cov_resp,
            BUCKET_PREFERRED: cov_pref,
        }
        weight_sum = sum(_BUCKET_BASE[b] for b, c in present.items() if c is not None)
        blended = (
            sum(_BUCKET_BASE[b] * c for b, c in present.items() if c is not None) / weight_sum
            if weight_sum
            else keyword_cov
        )
        score = round(blended * 100)

    strengths = sorted(
        (m for m in matches if m.status != STATUS_MISSING),
        key=lambda m: (-_STATUS_FACTOR[m.status], -m.weight, m.term),
    )
    gaps = sorted(
        (m for m in matches if m.status == STATUS_MISSING),
        key=lambda m: (m.bucket != BUCKET_REQUIRED, not m.is_concept, -m.weight, m.term),
    )

    return MatchResult(
        score=score,
        confidence=confidence,
        confidence_reason=reason,
        skill_signal_available=skill_signal,
        contamination=contamination,
        role_families=job.role_families,
        coverage=Coverage(
            required=cov_required,
            responsibility=cov_resp,
            preferred=cov_pref,
            concept=concept_cov,
            keyword=keyword_cov,
        ),
        strengths=strengths,
        gaps=gaps,
        resume_profile=resume_profile,
        job_profile=job_profile,
    )
