"""Domain-agnostic analysis of a job posting and a résumé.

The engine no longer depends on a curated skill list existing. A posting is
turned into a set of **weighted terms** where a term is either a recognized
concept (an optional normalizer — see ``taxonomy.py``) *or* a salient keyphrase
lifted straight from the text (RAKE-style, section-weighted, boilerplate
filtered). Because the generic keyphrase path always produces terms, the score
stays meaningful for fields the taxonomy has never heard of — and it never
invents a 100% where nothing was extracted.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from app.matching import keywords
from app.matching.sections import (
    KIND_BOILERPLATE,
    KIND_PREFERRED,
    KIND_REQUIRED,
    KIND_RESPONSIBILITY,
    split_sections,
)
from app.matching.taxonomy import (
    TIER_ADVANCED,
    TIER_CORE,
    TIER_FOUNDATIONAL,
    Concept,
    detect_concepts,
)

# How much a term's tier scales its weight (a nice-to-have "advanced" concept
# should not weigh like a core requirement).
_TIER_WEIGHT = {TIER_CORE: 1.0, TIER_FOUNDATIONAL: 0.8, TIER_ADVANCED: 0.6}
# A generic keyphrase weighs a little less than a recognized concept of equal
# section, since concepts carry normalization/synonymy the phrase doesn't.
_PHRASE_WEIGHT = 0.7
_MAX_PHRASES_PER_SECTION = 8

# Map concept categories to human role-family labels. Data-driven: whatever
# categories dominate the posting name the family; unknown → "General".
_CATEGORY_FAMILY = {
    "net_l1": "Network & infrastructure",
    "net_l2": "Network & infrastructure",
    "net_l3": "Network & infrastructure",
    "net_services": "Network & infrastructure",
    "net_security": "Network & infrastructure",
    "net_wireless": "Network & infrastructure",
    "net_ops": "Network operations",
    "net_vendor": "Network & infrastructure",
    "net_tool": "Network operations",
    "net_automation": "Network automation",
    "language": "Software engineering",
    "frontend": "Software engineering",
    "backend": "Software engineering",
    "mobile": "Software engineering",
    "practice": "Software engineering",
    "qa": "Quality engineering",
    "data_ml": "Data & ML",
    "database": "Data & ML",
    "cloud_devops": "Cloud & DevOps",
    "security": "Security",
    "design": "Design",
    "business": "Business",
    "healthcare": "Healthcare",
    "software": "Software engineering",
    "product": "Product & project",
    "sales": "Sales",
    "finance": "Finance",
}


@dataclass
class JobTerm:
    key: str  # matching key: concept id or stemmed phrase
    display: str  # human label
    weight: float
    is_concept: bool
    required: bool
    preferred: bool
    category: str | None = None
    tier: str | None = None


@dataclass
class JobAnalysis:
    terms: list[JobTerm]
    role_families: list[str]
    has_sections: bool
    noise_rate: float = 0.0  # residual scraped-chrome share of scored text


@dataclass
class ResumeAnalysis:
    concept_ids: set[str]
    concept_evidence: dict[str, list[str]]
    ngrams: set[str]  # stemmed contiguous n-grams
    unigrams: set[str]  # stemmed unigrams


def _concept_alias_tokens(concept_hits) -> set[str]:
    """Word-tokens of every matched concept's evidence, to drop phrase echoes."""
    tokens: set[str] = set()
    for hit in concept_hits.values():
        for phrase in hit.evidence:
            tokens.update(phrase.split(" "))
        tokens.update(hit.concept.id.split(" "))
    return tokens


def analyze_job(text: str) -> JobAnalysis:
    """Extract weighted, bucketed terms + a data-driven role family from a JD."""
    sections = split_sections(text)
    has_sections = not (len(sections) == 1 and sections[0].kind == KIND_RESPONSIBILITY)

    merged: dict[str, JobTerm] = {}
    category_weight: Counter[str] = Counter()
    scored_text: list[str] = []  # non-boilerplate text, for the noise estimate

    def add(term: JobTerm) -> None:
        existing = merged.get(term.key)
        if existing is None:
            merged[term.key] = term
        else:
            existing.weight = max(existing.weight, term.weight)
            existing.required = existing.required or term.required
            existing.preferred = existing.preferred or term.preferred

    for section in sections:
        if section.kind == KIND_BOILERPLATE:
            continue  # perks / EEO / "why join" — never role-fit signal

        required = section.kind == KIND_REQUIRED
        preferred = section.kind == KIND_PREFERRED
        scored_text.append(section.text)

        concept_hits = detect_concepts(section.text)
        for cid, hit in concept_hits.items():
            c: Concept = hit.concept
            weight = section.weight * _TIER_WEIGHT.get(c.tier, 1.0)
            add(
                JobTerm(
                    key=cid,
                    display=cid,
                    weight=weight,
                    is_concept=True,
                    required=required,
                    preferred=preferred,
                    category=c.category,
                    tier=c.tier,
                )
            )
            category_weight[c.category] += weight

        echo_tokens = _concept_alias_tokens(concept_hits)
        ranked = sorted(
            (
                (term, freq)
                for term, freq in keywords.candidate_phrases(section.text).items()
                if len(term) > 2
                and not all(tok in echo_tokens for tok in term.split(" "))
            ),
            key=lambda kv: (-kv[1], -len(kv[0].split(" ")), kv[0]),
        )
        # Prefer multi-word phrases, then fill with unigrams that a chosen phrase
        # doesn't already cover — so "patient assessment" doesn't also spawn
        # redundant "patient"/"assessment" terms that dilute the score.
        selected: list[str] = []
        covered: set[str] = set()
        for term, _freq in ranked:
            if " " in term and len(selected) < _MAX_PHRASES_PER_SECTION:
                selected.append(term)
                covered.update(term.split(" "))
        for term, _freq in ranked:
            if len(selected) >= _MAX_PHRASES_PER_SECTION:
                break
            if " " not in term and term not in covered:
                selected.append(term)

        for term in selected:
            add(
                JobTerm(
                    key=keywords.stem_term(term),
                    display=term,
                    weight=section.weight * _PHRASE_WEIGHT,
                    is_concept=False,
                    required=required,
                    preferred=preferred,
                )
            )

    role_families = _role_families(category_weight)
    return JobAnalysis(
        terms=list(merged.values()),
        role_families=role_families,
        has_sections=has_sections,
        noise_rate=keywords.noise_rate("\n".join(scored_text)),
    )


# A secondary family must carry at least this share of the top family's weight
# to be reported, so one stray generic concept can't mislabel the role.
_SECONDARY_FAMILY_MIN_SHARE = 0.4


def _role_families(category_weight: Counter[str]) -> list[str]:
    """Human role-family labels, most-weighted first. 'General' when unknown."""
    if sum(category_weight.values()) == 0:
        return ["General"]
    family_weight: Counter[str] = Counter()
    for category, weight in category_weight.items():
        family_weight[_CATEGORY_FAMILY.get(category, "General")] += weight
    ordered = [(fam, w) for fam, w in family_weight.most_common() if fam != "General"]
    if not ordered:
        return ["General"]
    top_weight = ordered[0][1]
    return [
        fam
        for fam, weight in ordered[:3]
        if fam == ordered[0][0] or weight >= _SECONDARY_FAMILY_MIN_SHARE * top_weight
    ]


def analyze_resume(text: str) -> ResumeAnalysis:
    """Concepts (with evidence) + stemmed n-gram/unigram sets for matching."""
    hits = detect_concepts(text)
    return ResumeAnalysis(
        concept_ids=set(hits.keys()),
        concept_evidence={cid: hit.evidence for cid, hit in hits.items()},
        ngrams=keywords.stemmed_ngrams(text),
        unigrams=keywords.stemmed_unigrams(text),
    )
