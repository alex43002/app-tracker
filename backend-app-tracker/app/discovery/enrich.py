"""Derived signals for a normalized posting (no generative AI — heuristics).

Computed once at ingest and stored so listing/filtering is cheap:

* **Eligibility** — `experienceLevel` (entry/mid/senior/lead), `requiresDegree`.
* **Quality** — `qualityFlags` (no salary, thin description, missing location,
  underpaid, spammy title) plus a 0–100 `qualityScore`.
* **Dedupe** — a `dedupeKey` (company + title + location) so the same role posted
  to several boards collapses into one clean listing.

Every function is pure and unit-testable; the heuristics are intentionally
conservative so a flag means something.
"""

from __future__ import annotations

import re

from app.discovery.normalize import infer_employment_type

# Annual salary below this looks like a data error or a genuinely underpaid
# full-time role; flagged for the user to scrutinise.
UNDERPAID_THRESHOLD = 35_000
# Descriptions shorter than this rarely contain enough to evaluate a role.
THIN_DESCRIPTION_CHARS = 250


def _norm(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


# --------------------------- experience level ------------------------------

_LEAD_RE = re.compile(r"\b(principal|staff|lead|director|head of|vp|chief)\b")
_SENIOR_RE = re.compile(r"\b(senior|sr\.?)\b")
_ENTRY_RE = re.compile(
    r"\b(intern|internship|junior|jr\.?|entry[- ]level|new grad|graduate|trainee)\b"
)
_MID_RE = re.compile(r"\b(mid[- ]level|intermediate)\b")
_YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*(?:to|-|–)?\s*(\d{1,2})?\s*years?")


def experience_level(title: str | None, description: str | None = None) -> str | None:
    """Best-effort seniority: entry|mid|senior|lead, or None if unclear.

    Title wins (it's the strongest signal); falls back to a years-of-experience
    requirement in the description.
    """
    t = _norm(title)
    if _LEAD_RE.search(t):
        return "lead"
    if _SENIOR_RE.search(t):
        return "senior"
    if _ENTRY_RE.search(t):
        return "entry"
    if _MID_RE.search(t):
        return "mid"

    d = _norm(description)
    match = _YEARS_RE.search(d)
    if match:
        low = int(match.group(1))
        if low >= 6:
            return "senior"
        if low >= 3:
            return "mid"
        return "entry"
    return None


# --------------------------- employment type -------------------------------

# Most ATS board postings are standard full-time roles; internships, contracts,
# part-time, and temporary positions almost always say so in the title or body.
# When nothing signals otherwise we assume full-time so the Discover employment
# filter has a concrete value to match (BUG-24).
DEFAULT_EMPLOYMENT_TYPE = "full-time"


def employment_type(posting: dict) -> str:
    """Resolve a posting's canonical employment type, never None.

    A structured value from the connector (e.g. Lever's `commitment`) wins;
    otherwise infer from the title/description; otherwise default to full-time.
    """
    existing = posting.get("employmentType")
    if existing:
        return existing
    inferred = infer_employment_type(posting.get("title"), posting.get("description"))
    return inferred or DEFAULT_EMPLOYMENT_TYPE


# --------------------------- degree requirement ----------------------------

_DEGREE_RE = re.compile(
    r"\b(bachelor'?s?|master'?s?|ph\.?d|mba|b\.?s\.?|m\.?s\.?|"
    r"b\.?a\.?|degree in|undergraduate degree)\b"
)


def requires_degree(description: str | None) -> bool:
    return bool(_DEGREE_RE.search(_norm(description)))


# --------------------------- work authorization ----------------------------

_SPONSOR_YES_RE = re.compile(
    r"(visa sponsorship|will sponsor|sponsorship (?:is )?available|"
    r"we sponsor|offer sponsorship|h-?1b sponsorship)"
)
_SPONSOR_NO_RE = re.compile(
    r"(no (?:visa )?sponsorship|not (?:able to|be able to) sponsor|"
    r"sponsorship (?:is )?not available|without sponsorship|"
    r"unable to sponsor|do(?:es)? not (?:provide|offer) sponsorship|"
    r"must be (?:legally )?authorized to work|"
    r"authorization to work .* without sponsorship)"
)
_CLEARANCE_RE = re.compile(
    r"(security clearance|secret clearance|ts/sci|"
    r"must be a (?:us|u\.s\.) citizen|active clearance)"
)


def sponsorship_available(description: str | None) -> bool | None:
    """True/False if the posting states its sponsorship stance, else None.

    A "no" statement wins over a "yes" — postings that mention both usually mean
    "we generally sponsor, but not for this role" or similar caveats.
    """
    d = _norm(description)
    if _SPONSOR_NO_RE.search(d):
        return False
    if _SPONSOR_YES_RE.search(d):
        return True
    return None


def clearance_required(description: str | None) -> bool:
    return bool(_CLEARANCE_RE.search(_norm(description)))


# --------------------------- quality ---------------------------------------

_SPAM_RE = re.compile(
    r"(\$\$\$|!!!|urgent|immediate start|no experience (?:needed|required)|"
    r"earn \$|work from home!!|apply now!!)"
)


def quality_flags(posting: dict) -> list[str]:
    """Signals that a posting may be unclear, misleading, or low quality."""
    flags: list[str] = []
    if posting.get("salaryMin") is None and posting.get("salaryMax") is None:
        flags.append("no_salary")
    if len(posting.get("description") or "") < THIN_DESCRIPTION_CHARS:
        flags.append("thin_description")
    if not posting.get("location"):
        flags.append("no_location")
    salary_max = posting.get("salaryMax")
    if salary_max is not None and salary_max < UNDERPAID_THRESHOLD:
        flags.append("underpaid")
    if _SPAM_RE.search(_norm(posting.get("title"))):
        flags.append("spammy_title")
    return flags


def quality_score(flags: list[str]) -> int:
    """0–100, higher is better. Each flag costs 20 points (floored at 0)."""
    return max(0, 100 - 20 * len(flags))


# --------------------------- dedupe ----------------------------------------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def dedupe_key(company: str | None, title: str | None, location: str | None) -> str:
    """Stable key for collapsing the same role posted across boards/sources."""
    parts = [
        _SLUG_RE.sub("-", _norm(company)).strip("-"),
        _SLUG_RE.sub("-", _norm(title)).strip("-"),
        _SLUG_RE.sub("-", _norm(location)).strip("-"),
    ]
    return "|".join(parts)


def enrich(posting: dict) -> dict:
    """Compute all derived fields for a normalized posting."""
    flags = quality_flags(posting)
    description = posting.get("description")
    return {
        "employmentType": employment_type(posting),
        "experienceLevel": experience_level(posting.get("title"), description),
        "requiresDegree": requires_degree(description),
        "sponsorshipAvailable": sponsorship_available(description),
        "clearanceRequired": clearance_required(description),
        "qualityFlags": flags,
        "qualityScore": quality_score(flags),
        "dedupeKey": dedupe_key(
            posting.get("company"), posting.get("title"), posting.get("location")
        ),
    }
