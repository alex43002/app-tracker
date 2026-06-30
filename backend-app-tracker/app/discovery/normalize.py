"""Normalization helpers shared by all discovery connectors.

Each ATS exposes its own field names and conventions; these helpers fold them
into one consistent shape so the rest of the app never has to special-case a
source. Everything here is pure and unit-testable.
"""

from __future__ import annotations

import re

# Canonical employment types used across the app (match the jobs module's
# vocabulary). Raw ATS values are mapped onto these.
EMPLOYMENT_TYPES = ("full-time", "part-time", "contract", "internship", "temporary")

_EMPLOYMENT_ALIASES: dict[str, str] = {
    "full time": "full-time",
    "fulltime": "full-time",
    "full-time": "full-time",
    "permanent": "full-time",
    "regular": "full-time",
    "part time": "part-time",
    "part-time": "part-time",
    "contract": "contract",
    "contractor": "contract",
    "contract-to-hire": "contract",
    "freelance": "contract",
    "intern": "internship",
    "internship": "internship",
    "co-op": "internship",
    "temporary": "temporary",
    "temp": "temporary",
    "seasonal": "temporary",
}


def normalize_employment_type(raw: str | None) -> str | None:
    """Map an ATS employment/commitment string to a canonical type, or None."""
    if not raw:
        return None
    key = re.sub(r"\s+", " ", raw.strip().lower())
    if key in _EMPLOYMENT_ALIASES:
        return _EMPLOYMENT_ALIASES[key]
    # Substring fallback so "Full-time (Remote)" still resolves.
    for alias, canonical in _EMPLOYMENT_ALIASES.items():
        if alias in key:
            return canonical
    return None


def normalize_location(raw: str | None) -> str | None:
    """Trim/collapse a location string; return None when empty."""
    if not raw:
        return None
    cleaned = re.sub(r"\s+", " ", raw.strip())
    return cleaned or None


# Matches money amounts like $120,000 / 120k / 120,000 USD. Captures the numeric
# part; the "k" suffix is expanded by the parser.
_MONEY_RE = re.compile(
    r"(?:\$|usd\s*)?\s*(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s*k|\d{4,7})",
    re.IGNORECASE,
)


def _to_amount(token: str) -> int | None:
    token = token.strip().lower().replace(",", "").replace("$", "")
    try:
        if token.endswith("k"):
            return int(float(token[:-1].strip()) * 1000)
        value = int(float(token))
    except ValueError:
        return None
    # Ignore implausible salaries (years, counts, etc.).
    if value < 10_000 or value > 10_000_000:
        return None
    return value


def parse_salary(text: str | None) -> tuple[int | None, int | None]:
    """Best-effort (min, max) annual salary from free text.

    Conservative on purpose: only returns numbers that look like real salaries
    (10k–10M). A single amount is returned as ``(amount, amount)``; a range as
    ``(low, high)``. Returns ``(None, None)`` when nothing plausible is found.
    """
    if not text:
        return None, None
    amounts: list[int] = []
    for match in _MONEY_RE.finditer(text):
        amount = _to_amount(match.group(1))
        if amount is not None:
            amounts.append(amount)
        if len(amounts) >= 4:
            break
    if not amounts:
        return None, None
    low, high = min(amounts), max(amounts)
    return low, high
