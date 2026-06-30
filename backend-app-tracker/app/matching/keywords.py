"""Keyword & skill extraction (no generative AI).

Two complementary signals are pulled out of a block of text:

* **Skills** — matched against a curated taxonomy of canonical skills and their
  aliases (e.g. ``js`` / ``node.js`` → ``javascript``). Multi-word and
  punctuation-bearing skills (``c++``, ``ci/cd``, ``machine learning``) are
  handled explicitly because a naive word tokenizer would shred them.

* **Keywords** — generic, domain-agnostic terms (unigrams + bigrams) ranked by
  frequency with stopwords removed. This keeps the engine useful for roles the
  taxonomy doesn't cover (nursing, accounting, …) instead of silently scoring
  zero.

Everything is lowercase, deterministic, and pure so the resulting score is
explainable and stable across runs.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Skills taxonomy
#
# canonical -> aliases. The canonical form is what we report; any alias found in
# the text counts as the canonical skill. Keep aliases lowercase. Order within a
# value doesn't matter. This is intentionally hand-curated (not ML-derived) so
# matches are predictable; extend it freely as new domains are needed.
# ---------------------------------------------------------------------------
SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    # Languages
    "python": ("python", "py"),
    "javascript": ("javascript", "js", "ecmascript"),
    "typescript": ("typescript", "ts"),
    "java": ("java",),
    "c++": ("c++", "cpp"),
    "c#": ("c#", "c sharp", "csharp"),
    "go": ("golang", "go lang"),
    "rust": ("rust",),
    "ruby": ("ruby",),
    "php": ("php",),
    "swift": ("swift",),
    "kotlin": ("kotlin",),
    "scala": ("scala",),
    "r": ("r language",),
    "sql": ("sql",),
    "bash": ("bash", "shell scripting", "shell script"),
    # Frontend
    "react": ("react", "react.js", "reactjs"),
    "angular": ("angular", "angular.js", "angularjs"),
    "vue": ("vue", "vue.js", "vuejs"),
    "next.js": ("next.js", "nextjs"),
    "html": ("html", "html5"),
    "css": ("css", "css3"),
    "tailwind": ("tailwind", "tailwindcss", "tailwind css"),
    "redux": ("redux",),
    # Backend / frameworks
    "node.js": ("node.js", "nodejs", "node"),
    "express": ("express", "express.js", "expressjs"),
    "django": ("django",),
    "flask": ("flask",),
    "fastapi": ("fastapi", "fast api"),
    "spring": ("spring", "spring boot", "springboot"),
    "rails": ("rails", "ruby on rails"),
    "graphql": ("graphql",),
    "rest": ("rest", "rest api", "restful", "restful api"),
    # Data / ML (classic — the engine itself uses no generative AI)
    "machine learning": ("machine learning", "ml"),
    "pandas": ("pandas",),
    "numpy": ("numpy",),
    "scikit-learn": ("scikit-learn", "sklearn", "scikit learn"),
    "tensorflow": ("tensorflow",),
    "pytorch": ("pytorch",),
    "spark": ("spark", "apache spark", "pyspark"),
    "etl": ("etl",),
    "data analysis": ("data analysis", "data analytics"),
    # Databases
    "postgresql": ("postgresql", "postgres", "psql"),
    "mysql": ("mysql",),
    "mongodb": ("mongodb", "mongo"),
    "redis": ("redis",),
    "elasticsearch": ("elasticsearch", "elastic search"),
    "sqlite": ("sqlite",),
    # Cloud / DevOps
    "aws": ("aws", "amazon web services"),
    "azure": ("azure", "microsoft azure"),
    "gcp": ("gcp", "google cloud", "google cloud platform"),
    "docker": ("docker",),
    "kubernetes": ("kubernetes", "k8s"),
    "terraform": ("terraform",),
    "ci/cd": ("ci/cd", "ci cd", "cicd", "continuous integration"),
    "jenkins": ("jenkins",),
    "github actions": ("github actions",),
    "linux": ("linux", "unix"),
    "nginx": ("nginx",),
    # Practices / methods
    "agile": ("agile",),
    "scrum": ("scrum",),
    "kanban": ("kanban",),
    "tdd": ("tdd", "test driven development", "test-driven development"),
    "microservices": ("microservices", "micro services"),
    "unit testing": ("unit testing", "unit tests"),
    # Tools
    "git": ("git",),
    "jira": ("jira",),
    "figma": ("figma",),
    "excel": ("excel", "microsoft excel"),
    "tableau": ("tableau",),
    "power bi": ("power bi", "powerbi"),
    # Soft skills
    "communication": ("communication",),
    "leadership": ("leadership",),
    "teamwork": ("teamwork", "team work"),
    "problem solving": ("problem solving", "problem-solving"),
    "project management": ("project management",),
}

# Reverse index: alias -> canonical. Longer aliases are matched first so
# "node.js" wins over "node" and "machine learning" over "learning".
_ALIAS_TO_CANONICAL: dict[str, str] = {}
for _canonical, _aliases in SKILL_ALIASES.items():
    for _alias in _aliases:
        _ALIAS_TO_CANONICAL[_alias] = _canonical

_ALIASES_BY_LENGTH = sorted(_ALIAS_TO_CANONICAL, key=len, reverse=True)


# Common English + résumé/JD boilerplate stopwords. Kept compact on purpose —
# the goal is to drop noise, not to be a linguistics-grade list.
STOPWORDS: frozenset[str] = frozenset(
    """
    a an the and or but if then else for to of in on at by with from as is are
    was were be been being this that these those it its we you they he she them
    our your their his her have has had do does did will would can could should
    may might must not no nor so than too very just about into over under again
    more most other some such own same up down out off above below between
    through during before after here there all any both each few many much
    will work working experience experiences year years month months
    role roles responsibility responsibilities requirement requirements
    skill skills ability abilities team teams company companies including
    include includes etc using used use job position candidate candidates
    strong excellent good knowledge understanding plus preferred required
    looking ideal ability across within while also new well help build building
    need needs want wants seeking seek join apply please ideally must
    proficiency proficient familiarity familiar expertise expert hands
    """.split()
)

# A token: words (incl. internal . + # / -) so c++, ci/cd, node.js survive.
_WORD_RE = re.compile(r"[a-z0-9][a-z0-9.+#/_-]*[a-z0-9]|[a-z0-9]")


def normalize(text: str) -> str:
    """Lowercase and collapse whitespace; keep skill-bearing punctuation."""
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _tokens(norm_text: str) -> list[str]:
    """Word tokens, stripping trailing punctuation that isn't skill-bearing."""
    out: list[str] = []
    for raw in _WORD_RE.findall(norm_text):
        tok = raw.strip(".-_/")
        if tok:
            out.append(tok)
    return out


def extract_skills(text: str) -> list[str]:
    """Canonical skills present in ``text``, in first-appearance order.

    Aliases are matched as whole tokens/phrases (word-boundary aware) so
    ``java`` does not match inside ``javascript`` and ``go`` does not match
    inside ``goal``.
    """
    norm = normalize(text)
    found: dict[str, int] = {}
    for alias in _ALIASES_BY_LENGTH:
        # Word-boundary-ish match: alias must be flanked by non-token chars.
        # We can't use \b because aliases contain +, #, /, . — build an explicit
        # boundary that treats those as part of the token.
        pattern = r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])"
        m = re.search(pattern, norm)
        if m:
            canonical = _ALIAS_TO_CANONICAL[alias]
            found.setdefault(canonical, m.start())
    return [c for c, _ in sorted(found.items(), key=lambda kv: kv[1])]


def extract_keywords(text: str, *, limit: int = 30) -> list[tuple[str, int]]:
    """Generic ranked keywords (unigrams + bigrams) with their frequency.

    Stopwords and pure numbers are dropped. Bigrams are only kept when both
    halves are content words. Returned highest-frequency first; ties broken
    alphabetically for determinism.
    """
    toks = [t for t in _tokens(normalize(text)) if t not in STOPWORDS and not t.isdigit()]
    counts: Counter[str] = Counter()
    counts.update(t for t in toks if len(t) > 1)

    # Bigrams from the *content* token stream (stopwords already removed).
    for a, b in zip(toks, toks[1:]):
        if len(a) > 1 and len(b) > 1:
            counts[f"{a} {b}"] += 1

    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return ranked[:limit]


@dataclass(frozen=True)
class TermProfile:
    """The weighted terms describing a block of text (résumé or job)."""

    skills: list[str]
    keywords: list[str]

    @property
    def all_terms(self) -> set[str]:
        return set(self.skills) | set(self.keywords)


def _skill_token_set(skills: list[str]) -> set[str]:
    """All alias word-tokens belonging to the given canonical skills.

    Used to drop generic keywords that merely echo a skill (e.g. the bigram
    ``django postgresql``) so the skill and keyword signals don't overlap.
    """
    tokens: set[str] = set()
    for canonical in skills:
        for alias in SKILL_ALIASES.get(canonical, (canonical,)):
            tokens.update(_tokens(alias))
        tokens.update(_tokens(canonical))
    return tokens


def profile(text: str, *, keyword_limit: int = 30) -> TermProfile:
    """Full term profile for a block of text: skills + ranked keywords."""
    skills = extract_skills(text)
    skill_set = set(skills)
    skill_tokens = _skill_token_set(skills)

    def _is_skill_echo(term: str) -> bool:
        # Drop a keyword that is a skill, or a phrase made entirely of skill
        # tokens (e.g. "django postgresql"). Phrases mixing a skill with a real
        # word (e.g. "python developer") are kept.
        if term in skill_set:
            return True
        parts = term.split(" ")
        return all(p in skill_tokens for p in parts)

    keywords = [
        term for term, _ in extract_keywords(text, limit=keyword_limit)
        if not _is_skill_echo(term)
    ]
    return TermProfile(skills=skills, keywords=keywords)
