"""Classify a recruiting email into an application-tracking signal.

Deterministic keyword/phrase heuristics (no generative AI). Given the text of
an email (and optionally its subject), classify it as an application
confirmation, an interview invitation, a rejection, an offer, a recruiter
outreach, or "other", and map that to the suggested job status. Each category
reports the phrases that fired so the result is explainable.

Category precedence (highest first): offer, rejection, interview,
application_received, recruiter. Rejection beats interview because a rejection
email often mentions the interview it's declining.
"""

from __future__ import annotations

import re

# Category -> suggested job status (None = informational, no status change).
CATEGORY_STATUS: dict[str, str | None] = {
    "offer": "offer",
    "rejection": "rejected",
    "interview": "interviewing",
    "application_received": "applied",
    "recruiter": None,
    "other": None,
}

# Ordered by precedence. Each phrase is a compiled, case-insensitive pattern.
_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "offer",
        (
            r"pleased to offer",
            r"happy to offer",
            r"extend (?:you )?an offer",
            r"offer of employment",
            r"job offer",
            r"offer letter",
            r"we'?d like to offer",
        ),
    ),
    (
        "rejection",
        (
            r"unfortunately",
            r"we regret",
            r"will not be moving forward",
            r"not (?:be )?moving forward",
            r"decided (?:not to|to not) (?:proceed|move forward)",
            r"move forward with other candidates",
            r"other candidates",
            r"position has been filled",
            r"role has been filled",
            r"not (?:be )?(?:selected|proceeding)",
            r"no longer under consideration",
            r"wish you (?:the best|luck)",
        ),
    ),
    (
        "interview",
        (
            r"schedule (?:an?|your) interview",
            r"invite you to (?:an? )?interview",
            r"like to (?:invite|schedule|set up).{0,30}interview",
            r"interview invitation",
            r"phone screen",
            r"technical (?:interview|screen)",
            r"next round",
            r"availability for (?:a |an |the )?(?:call|interview|chat)",
            r"set up (?:a |some )?time",
            r"book a time",
            r"move(?:d)? (?:you )?(?:to|into) the (?:next|interview) (?:round|stage)",
        ),
    ),
    (
        "application_received",
        (
            r"thank you for applying",
            r"thanks for applying",
            r"application (?:has been |was )?received",
            r"received your application",
            r"we have received your application",
            r"thank you for your (?:interest|application)",
            r"successfully (?:applied|submitted)",
            r"application (?:has been )?submitted",
        ),
    ),
    (
        "recruiter",
        (
            r"came across your profile",
            r"found your profile",
            r"reaching out",
            r"i'?m a (?:recruiter|technical recruiter|talent)",
            r"opportunity (?:that )?might (?:be of )?interest",
            r"exciting (?:role|opportunity)",
            r"would you be (?:open|interested)",
            r"are you (?:open|interested)",
        ),
    ),
)

_COMPILED: tuple[tuple[str, tuple[re.Pattern[str], ...]], ...] = tuple(
    (category, tuple(re.compile(p, re.IGNORECASE) for p in patterns))
    for category, patterns in _PATTERNS
)


def classify_email(text: str, subject: str | None = None) -> dict:
    """Classify an email; returns category, suggested status, and matched signals."""
    blob = f"{subject or ''}\n{text or ''}"

    scores: dict[str, list[str]] = {}
    for category, patterns in _COMPILED:
        hits = [m.group(0) for p in patterns for m in [p.search(blob)] if m]
        if hits:
            scores[category] = hits

    if not scores:
        return {
            "category": "other",
            "suggestedStatus": None,
            "signals": [],
            "confidence": "low",
        }

    # Highest hit count wins; ties fall back to declared precedence order.
    precedence = {cat: i for i, (cat, _) in enumerate(_PATTERNS)}
    category = min(
        scores, key=lambda c: (-len(scores[c]), precedence[c])
    )
    signals = scores[category]
    confidence = "high" if len(signals) >= 2 else "medium"
    return {
        "category": category,
        "suggestedStatus": CATEGORY_STATUS[category],
        "signals": signals,
        "confidence": confidence,
    }
