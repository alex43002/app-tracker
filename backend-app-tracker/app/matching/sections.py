"""Split a job description into weighted sections — domain-agnostic.

Every posting, in any field, tends to have the same *shape*: some required
qualifications, some day-to-day responsibilities, some nice-to-haves, and a lot
of company boilerplate (benefits, EEO statements, "why join us"). Terms carry
very different signal depending on which of those they came from — "benefits"
in a perks blurb is noise; "venipuncture" under Requirements is the whole point.

This module finds those sections by their headers (no ML, no domain
assumptions) and assigns each a weight. If a posting has no recognizable
headers we fall back to treating the whole thing as responsibilities, so the
generic path still works for terse or unusually formatted posts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Section kinds and their share of "what matters" in a posting.
KIND_REQUIRED = "required"
KIND_RESPONSIBILITY = "responsibility"
KIND_PREFERRED = "preferred"
KIND_CONTEXT = "context"
KIND_BOILERPLATE = "boilerplate"

SECTION_WEIGHT: dict[str, float] = {
    KIND_REQUIRED: 0.40,
    KIND_RESPONSIBILITY: 0.30,
    KIND_PREFERRED: 0.18,
    KIND_CONTEXT: 0.10,
    KIND_BOILERPLATE: 0.02,
}

# Header phrase → kind. Matched case-insensitively as a whole-line-ish heading.
# Ordered longest/most-specific first within each kind isn't required because we
# test membership per line, but keep preferred-before-required-ish phrasings
# distinct ("basic qualifications" vs "preferred qualifications").
_HEADER_RULES: tuple[tuple[str, str], ...] = (
    # Preferred / nice-to-have (check before generic "qualifications").
    (r"preferred (qualification|skill|requirement)", KIND_PREFERRED),
    (r"nice[- ]to[- ]have", KIND_PREFERRED),
    (r"(bonus|desired|preferred|a plus|pluses|good to have)", KIND_PREFERRED),
    # Required.
    (r"(minimum|basic|required|essential) (qualification|requirement|skill)", KIND_REQUIRED),
    (r"(qualification|requirement)s?\b", KIND_REQUIRED),
    (r"what (you'll|you will) need", KIND_REQUIRED),
    (r"who you are", KIND_REQUIRED),
    (r"must[- ]have", KIND_REQUIRED),
    # Responsibilities.
    (r"responsibilit", KIND_RESPONSIBILITY),
    (r"what (you'll|you will) do", KIND_RESPONSIBILITY),
    (r"the role", KIND_RESPONSIBILITY),
    (r"day[- ]to[- ]day", KIND_RESPONSIBILITY),
    (r"duties", KIND_RESPONSIBILITY),
    (r"in this role", KIND_RESPONSIBILITY),
    # Context.
    (r"about (the|this) (job|role|position|team|opportunity)", KIND_CONTEXT),
    (r"(overview|summary|introduction)", KIND_CONTEXT),
    # Boilerplate.
    (r"(benefits|perks|compensation|salary|pay range|what we offer)", KIND_BOILERPLATE),
    (r"(about (us|the company|our)|who we are|why join|our (mission|team|company))", KIND_BOILERPLATE),
    (r"(equal opportunity|eeo|diversity|inclusion|accommodation|e-verify)", KIND_BOILERPLATE),
    (r"(how to apply|application (process|instructions)|to apply)", KIND_BOILERPLATE),
)
_HEADER_RES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pat, re.IGNORECASE), kind) for pat, kind in _HEADER_RULES
)

# A heading line is short and header-like (few words, optional trailing colon,
# markdown/bullet markers). This keeps a sentence that merely *mentions*
# "responsibilities" from being treated as a header.
_MAX_HEADER_WORDS = 7


@dataclass
class Section:
    kind: str
    weight: float
    text: str


def _looks_like_heading(line: str) -> bool:
    stripped = line.strip().lstrip("#*->•·▪◦ ").strip()
    if not stripped or len(stripped) > 60:
        return False
    # Headers are short; a trailing colon is a strong signal, otherwise require
    # a small word count so prose sentences don't qualify.
    words = re.findall(r"[A-Za-z']+", stripped)
    if not words:
        return False
    return stripped.endswith(":") or len(words) <= _MAX_HEADER_WORDS


def _classify_heading(line: str) -> str | None:
    if not _looks_like_heading(line):
        return None
    for pattern, kind in _HEADER_RES:
        if pattern.search(line):
            return kind
    return None


def split_sections(text: str) -> list[Section]:
    """Group ``text`` into weighted sections by detected headers.

    Text before the first recognized header is treated as context. If no header
    is found at all, the whole posting becomes one responsibility section so the
    downstream generic extraction still has something weighted to work with.
    """
    lines = (text or "").splitlines()
    buckets: dict[str, list[str]] = {}
    current = KIND_CONTEXT
    saw_header = False

    for line in lines:
        kind = _classify_heading(line)
        if kind is not None:
            current = kind
            saw_header = True
            continue
        if line.strip():
            buckets.setdefault(current, []).append(line)

    if not saw_header:
        # No structure detected — score the whole thing as responsibilities so a
        # terse post isn't unfairly diluted as "context".
        body = "\n".join(l for l in lines if l.strip())
        return [Section(KIND_RESPONSIBILITY, SECTION_WEIGHT[KIND_RESPONSIBILITY], body)]

    return [
        Section(kind, SECTION_WEIGHT[kind], "\n".join(chunk))
        for kind, chunk in buckets.items()
        if chunk
    ]
