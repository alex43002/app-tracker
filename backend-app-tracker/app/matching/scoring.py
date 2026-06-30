"""Score a résumé against a job description.

The score answers "how well does this résumé cover what the posting asks for?"
It is intentionally *recall-oriented from the job's side*: a term the job
mentions but the résumé lacks is a gap; a term the résumé has that the job never
mentions is neither rewarded nor penalised (padding shouldn't inflate fit).

Two weighted signals are combined:

* **Skill coverage** — the fraction of the job's required skills the résumé
  demonstrates. Weighted most heavily because skills are the strongest,
  least-noisy signal.
* **Keyword coverage** — the fraction of the job's other salient keywords the
  résumé covers. Catches domains the taxonomy doesn't model.

Output is a 0–100 integer plus the matched terms and the gaps, so the UI can
render both the number and *why*.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.matching.keywords import TermProfile, profile, stem_term, vocabulary

# Skills dominate the score; keyword coverage is a supporting signal. If a job
# posting yields no skills at all (taxonomy miss), scoring falls back entirely
# to keyword coverage so the number stays meaningful.
_SKILL_WEIGHT = 0.7
_KEYWORD_WEIGHT = 0.3


@dataclass(frozen=True)
class ScoreBreakdown:
    skill_coverage: float  # 0..1
    keyword_coverage: float  # 0..1
    matched_skills: list[str]
    missing_skills: list[str]
    matched_keywords: list[str]
    missing_keywords: list[str]


@dataclass(frozen=True)
class MatchResult:
    score: int  # 0..100
    breakdown: ScoreBreakdown
    resume_profile: TermProfile
    job_profile: TermProfile
    # Ordered, de-duplicated gap list (skills first) for the UI's gap analysis.
    gaps: list[str] = field(default_factory=list)


def _coverage(required: list[str], present: set[str]) -> tuple[float, list[str], list[str]]:
    """Split ``required`` into matched/missing and return the matched fraction."""
    if not required:
        return 1.0, [], []
    matched = [t for t in required if t in present]
    missing = [t for t in required if t not in present]
    return len(matched) / len(required), matched, missing


def _keyword_coverage(
    required: list[str], resume_vocab: set[str]
) -> tuple[float, list[str], list[str]]:
    """Keyword coverage with light stemming against the full résumé vocabulary.

    A required keyword counts as covered if it (or its stemmed form) appears
    anywhere in the résumé. Matched/missing keep the original job phrasing so
    the UI shows readable terms.
    """
    if not required:
        return 1.0, [], []
    matched, missing = [], []
    for term in required:
        if term in resume_vocab or stem_term(term) in resume_vocab:
            matched.append(term)
        else:
            missing.append(term)
    return len(matched) / len(required), matched, missing


def score_match(resume_text: str, job_text: str, *, keyword_limit: int = 25) -> MatchResult:
    """Compare a résumé to a job description and return an explainable score."""
    resume = profile(resume_text, keyword_limit=keyword_limit * 2)
    job = profile(job_text, keyword_limit=keyword_limit)

    resume_terms = resume.all_terms
    resume_vocab = vocabulary(resume_text)

    skill_cov, matched_skills, missing_skills = _coverage(job.skills, resume_terms)
    kw_cov, matched_keywords, missing_keywords = _keyword_coverage(
        job.keywords, resume_vocab
    )

    # Blend the two signals. When the job has no detectable skills, lean fully on
    # keyword coverage so the score doesn't collapse to a meaningless 0/100.
    if job.skills and job.keywords:
        blended = _SKILL_WEIGHT * skill_cov + _KEYWORD_WEIGHT * kw_cov
    elif job.skills:
        blended = skill_cov
    else:
        blended = kw_cov

    score = round(blended * 100)

    # Gap list: missing skills first (highest signal), then missing keywords.
    gaps = missing_skills + missing_keywords

    return MatchResult(
        score=score,
        breakdown=ScoreBreakdown(
            skill_coverage=round(skill_cov, 4),
            keyword_coverage=round(kw_cov, 4),
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            matched_keywords=matched_keywords,
            missing_keywords=missing_keywords,
        ),
        resume_profile=resume,
        job_profile=job,
        gaps=gaps,
    )
