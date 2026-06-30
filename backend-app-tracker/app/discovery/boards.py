"""Friendlier board-token discovery (FEAT-23).

Board tokens are opaque ATS slugs, and users rarely know what they are or where
to find them. This module makes them discoverable two ways:

* :func:`extract_board` turns a pasted careers URL (Greenhouse / Lever) into a
  ``(source, token)`` pair.
* :data:`KNOWN_COMPANIES` is a small curated directory of popular public boards
  so users can pick a company instead of guessing a slug; :func:`search_companies`
  filters it.

Everything here is pure and unit-testable — no network access.
"""

from __future__ import annotations

import re

# Each pattern captures the board token in group 1. The host/path forms below
# cover the public careers URLs people actually paste. Order matters: more
# specific hosts come first so a generic catch-all never wins.
_URL_PATTERNS: tuple[tuple[str, "re.Pattern[str]"], ...] = (
    # Greenhouse — hosted board, embedded board, and the public JSON API.
    (
        "greenhouse",
        re.compile(
            r"boards\.greenhouse\.io/(?:embed/job_board\?for=)?([A-Za-z0-9_-]+)",
            re.IGNORECASE,
        ),
    ),
    ("greenhouse", re.compile(r"job-boards\.greenhouse\.io/([A-Za-z0-9_-]+)", re.I)),
    (
        "greenhouse",
        re.compile(r"boards-api\.greenhouse\.io/v1/boards/([A-Za-z0-9_-]+)", re.I),
    ),
    # Lever — hosted board and the public JSON API.
    ("lever", re.compile(r"jobs\.lever\.co/([A-Za-z0-9_-]+)", re.I)),
    ("lever", re.compile(r"api\.lever\.co/v0/postings/([A-Za-z0-9_-]+)", re.I)),
)

# Path segments that look like a token capture but are really part of the URL
# structure (e.g. ``boards.greenhouse.io/embed/...``).
_NON_TOKENS = {"embed", "job_board", "v0", "v1", "boards", "postings", "www"}


def extract_board(url: str | None) -> tuple[str, str] | None:
    """Return ``(source, board_token)`` parsed from a careers URL, or None.

    Accepts URLs with or without a scheme; matching is case-insensitive. Returns
    None when the URL isn't a recognised Greenhouse/Lever board.
    """
    if not url:
        return None
    text = url.strip()
    for source, pattern in _URL_PATTERNS:
        match = pattern.search(text)
        if match:
            token = match.group(1)
            if token.lower() in _NON_TOKENS:
                continue
            return source, token
    return None


# --------------------------------------------------------------------------- #
# Curated directory of popular public boards
# --------------------------------------------------------------------------- #

# A small, hand-picked starter set so the company picker isn't empty. Each entry
# is a public board on a supported ATS. This is intentionally a sample, not an
# exhaustive index — users can always paste a careers URL or type a token.
KNOWN_COMPANIES: tuple[dict[str, str], ...] = (
    {"name": "Stripe", "source": "greenhouse", "boardToken": "stripe"},
    {"name": "Airbnb", "source": "greenhouse", "boardToken": "airbnb"},
    {"name": "Lyft", "source": "greenhouse", "boardToken": "lyft"},
    {"name": "DoorDash", "source": "greenhouse", "boardToken": "doordash"},
    {"name": "Coinbase", "source": "greenhouse", "boardToken": "coinbase"},
    {"name": "Databricks", "source": "greenhouse", "boardToken": "databricks"},
    {"name": "Robinhood", "source": "greenhouse", "boardToken": "robinhood"},
    {"name": "Figma", "source": "greenhouse", "boardToken": "figma"},
    {"name": "Reddit", "source": "greenhouse", "boardToken": "reddit"},
    {"name": "Cloudflare", "source": "greenhouse", "boardToken": "cloudflare"},
    {"name": "Brex", "source": "greenhouse", "boardToken": "brex"},
    {"name": "Plaid", "source": "lever", "boardToken": "plaid"},
)


def search_companies(query: str | None, limit: int = 20) -> list[dict[str, str]]:
    """Case-insensitive substring search over the curated directory by name.

    An empty/None query returns the start of the directory (capped to ``limit``).
    """
    limit = max(1, limit)
    if not query or not query.strip():
        return [dict(c) for c in KNOWN_COMPANIES[:limit]]
    needle = query.strip().lower()
    matches = [
        dict(c) for c in KNOWN_COMPANIES if needle in c["name"].lower()
    ]
    return matches[:limit]
