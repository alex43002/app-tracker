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
    "objective-c": ("objective-c", "objective c", "objc"),
    "dart": ("dart",),
    "elixir": ("elixir",),
    "perl": ("perl",),
    "matlab": ("matlab",),
    "solidity": ("solidity",),
    "groovy": ("groovy",),
    # Frontend
    "react": ("react", "react.js", "reactjs"),
    "angular": ("angular", "angular.js", "angularjs"),
    "vue": ("vue", "vue.js", "vuejs"),
    "next.js": ("next.js", "nextjs"),
    "html": ("html", "html5"),
    "css": ("css", "css3"),
    "tailwind": ("tailwind", "tailwindcss", "tailwind css"),
    "redux": ("redux",),
    "svelte": ("svelte", "sveltekit"),
    "sass": ("sass", "scss"),
    "jquery": ("jquery",),
    "webpack": ("webpack",),
    "vite": ("vite",),
    "bootstrap": ("bootstrap",),
    "material ui": ("material ui", "material-ui", "mui"),
    "accessibility": ("accessibility", "a11y", "wcag"),
    # Backend / frameworks
    "node.js": ("node.js", "nodejs", "node"),
    "express": ("express", "express.js", "expressjs"),
    "nest.js": ("nest.js", "nestjs"),
    "django": ("django",),
    "flask": ("flask",),
    "fastapi": ("fastapi", "fast api"),
    "spring": ("spring", "spring boot", "springboot"),
    "rails": ("rails", "ruby on rails"),
    ".net": (".net", "dotnet", "asp.net", "asp.net core"),
    "laravel": ("laravel",),
    "graphql": ("graphql",),
    "rest": ("rest", "rest api", "restful", "restful api"),
    "grpc": ("grpc",),
    "soap": ("soap",),
    "websockets": ("websockets", "websocket"),
    # Data / ML (classic — the engine itself uses no generative AI)
    "machine learning": ("machine learning", "ml"),
    "deep learning": ("deep learning",),
    "nlp": ("nlp", "natural language processing"),
    "computer vision": ("computer vision",),
    "data engineering": ("data engineering",),
    "data science": ("data science", "data scientist"),
    "pandas": ("pandas",),
    "numpy": ("numpy",),
    "scikit-learn": ("scikit-learn", "sklearn", "scikit learn"),
    "tensorflow": ("tensorflow",),
    "pytorch": ("pytorch",),
    "keras": ("keras",),
    "matplotlib": ("matplotlib",),
    "spark": ("spark", "apache spark", "pyspark"),
    "hadoop": ("hadoop",),
    "kafka": ("kafka", "apache kafka"),
    "airflow": ("airflow", "apache airflow"),
    "dbt": ("dbt",),
    "etl": ("etl", "elt"),
    "data analysis": ("data analysis", "data analytics"),
    "data warehousing": ("data warehousing", "data warehouse"),
    # Databases
    "postgresql": ("postgresql", "postgres", "psql"),
    "mysql": ("mysql",),
    "mongodb": ("mongodb", "mongo"),
    "redis": ("redis",),
    "elasticsearch": ("elasticsearch", "elastic search"),
    "sqlite": ("sqlite",),
    "oracle": ("oracle", "oracle db"),
    "sql server": ("sql server", "mssql", "microsoft sql server"),
    "dynamodb": ("dynamodb", "dynamo db"),
    "cassandra": ("cassandra",),
    "snowflake": ("snowflake",),
    "bigquery": ("bigquery", "big query"),
    "neo4j": ("neo4j",),
    # Cloud / DevOps
    "aws": ("aws", "amazon web services"),
    "azure": ("azure", "microsoft azure"),
    "gcp": ("gcp", "google cloud", "google cloud platform"),
    "docker": ("docker",),
    "kubernetes": ("kubernetes", "k8s"),
    "terraform": ("terraform",),
    "ansible": ("ansible",),
    "helm": ("helm",),
    "prometheus": ("prometheus",),
    "grafana": ("grafana",),
    "ci/cd": ("ci/cd", "ci cd", "cicd", "continuous integration", "continuous delivery"),
    "jenkins": ("jenkins",),
    "github actions": ("github actions",),
    "gitlab ci": ("gitlab ci", "gitlab-ci"),
    "circleci": ("circleci", "circle ci"),
    "lambda": ("aws lambda", "lambda functions"),
    "serverless": ("serverless",),
    "linux": ("linux", "unix"),
    "nginx": ("nginx",),
    "kafka streams": ("kafka streams",),
    # Mobile
    "android": ("android",),
    "ios": ("ios",),
    "react native": ("react native",),
    "flutter": ("flutter",),
    "xamarin": ("xamarin",),
    # Security
    "penetration testing": ("penetration testing", "pen testing", "pentesting"),
    "owasp": ("owasp",),
    "siem": ("siem",),
    "oauth": ("oauth", "oauth2"),
    "jwt": ("jwt",),
    "encryption": ("encryption", "cryptography"),
    # QA / testing
    "selenium": ("selenium",),
    "cypress": ("cypress",),
    "playwright": ("playwright",),
    "jest": ("jest",),
    "pytest": ("pytest",),
    "junit": ("junit",),
    # Practices / methods
    "agile": ("agile",),
    "scrum": ("scrum",),
    "kanban": ("kanban",),
    "tdd": ("tdd", "test driven development", "test-driven development"),
    "microservices": ("microservices", "micro services"),
    "unit testing": ("unit testing", "unit tests"),
    "object-oriented programming": ("object-oriented programming", "oop"),
    "design patterns": ("design patterns",),
    "data structures": ("data structures",),
    "algorithms": ("algorithms",),
    "mvc": ("mvc",),
    # Tools
    "git": ("git",),
    "jira": ("jira",),
    "confluence": ("confluence",),
    "figma": ("figma",),
    "excel": ("excel", "microsoft excel"),
    "tableau": ("tableau",),
    "power bi": ("power bi", "powerbi"),
    "looker": ("looker",),
    "salesforce": ("salesforce",),
    "hubspot": ("hubspot",),
    # Design
    "ui/ux": ("ui/ux", "ux design", "ui design", "user experience"),
    "sketch": ("sketch app",),
    "photoshop": ("photoshop", "adobe photoshop"),
    "illustrator": ("illustrator", "adobe illustrator"),
    "wireframing": ("wireframing", "wireframe"),
    # Marketing / analytics
    "seo": ("seo", "search engine optimization"),
    "sem": ("sem",),
    "google analytics": ("google analytics",),
    "content marketing": ("content marketing",),
    # Business / finance
    "financial modeling": ("financial modeling", "financial modelling"),
    "quickbooks": ("quickbooks",),
    "gaap": ("gaap",),
    "stakeholder management": ("stakeholder management",),
    "product management": ("product management",),
    # Healthcare / compliance
    "hipaa": ("hipaa",),
    "emr": (
        "emr", "ehr", "electronic medical record", "electronic medical records",
        "electronic health record", "electronic health records",
    ),
    # Soft skills
    "communication": ("communication",),
    "leadership": ("leadership",),
    "teamwork": ("teamwork", "team work"),
    "problem solving": ("problem solving", "problem-solving"),
    "project management": ("project management",),
    "mentoring": ("mentoring", "mentorship"),
}

# Reverse index: alias -> canonical. Longer aliases are matched first so
# "node.js" wins over "node" and "machine learning" over "learning".
_ALIAS_TO_CANONICAL: dict[str, str] = {}
for _canonical, _aliases in SKILL_ALIASES.items():
    for _alias in _aliases:
        _ALIAS_TO_CANONICAL[_alias] = _canonical

_ALIASES_BY_LENGTH = sorted(_ALIAS_TO_CANONICAL, key=len, reverse=True)


# Common English + résumé/JD boilerplate stopwords. Kept compact on purpose —
# the goal is to drop noise, not to be a linguistics-grade list. The second
# block is domain-agnostic job-post scaffolding and company/legal/benefits
# boilerplate: words like "benefits", "qualifications" or "equal opportunity"
# say nothing about role fit in *any* field, so they must never move a score.
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

    qualification qualifications basic minimum essential desired nice
    bonus preferred equivalent related field fields following example examples
    various multiple several proven demonstrated bachelor master masters
    degree diploma education educational gpa
    benefit benefits perk perks compensation salary bonus insurance
    equal opportunity employer employment diversity inclusion inclusive
    accommodation accommodations applicant applicants veteran veterans
    disability disabilities gender race religion age sexual orientation
    eeo verify authorized authorization sponsorship
    mission vision culture values people world global globally worldwide
    business businesses environment environments area areas current future
    day days daily weekly google amazon meta microsoft
    users user customers customer clients client stakeholders stakeholder
    following e.g eg i.e ie per etc provide provides providing ensure ensures
    ensuring maintain maintains maintaining support supports supporting
    partner partners partnering deliver delivers delivering drive drives

    careers career cookie cookies privacy copyright sitemap newsletter
    trademark reserved skip login signin signup subscribe home menu
    navigation footer header share follow connect related recommended
    featured similar suggested apply overview posted req id location locations
    """.split()
)

# Web-chrome / legal / geo tokens that survive section filtering and leak into
# keyphrases from scraped pages (FEAT-31). Unlike STOPWORDS (dropped wholesale),
# these gate whole *phrases* via ``is_noise_phrase`` so a legitimate compound is
# only rejected when a noise token is actually present.
_NOISE_TOKENS: frozenset[str] = frozenset(
    """
    inc llc ltd corp incorporated holdings alphabet
    criminal histories felony conviction convictions arrest
    recaptcha captcha
    """.split()
)

# Unambiguous state/region abbreviations for location chips ("melbourne vic").
# Only forms that aren't also common English words are listed so real terms
# aren't nuked; matched only as the trailing token of a multi-word phrase.
_REGION_ABBREV: frozenset[str] = frozenset(
    """
    nsw vic qld tas
    tx fl ny nj nc sc ga oh mi mn tn az nv nm ut ca il
    uk usa apac emea
    """.split()
)

# person_outline, arrow_forward, location_on … Material-icon ligatures come
# through the tokenizer as one snake_case token; no real skill looks like this.
_LIGATURE_RE = re.compile(r"[a-z]+_[a-z]+")


def is_noise_phrase(phrase: str) -> bool:
    """True if a keyphrase is scraped page-chrome, not role signal (FEAT-31).

    Rejects icon ligatures ("person_outline"), company/legal tokens
    ("alphabet inc"), repeated-token strings ("careers careers skip") and
    location chips ("melbourne vic"). Genuine skills and compounds pass.
    """
    tokens = phrase.split(" ")
    if not tokens or not phrase:
        return True
    if any(_LIGATURE_RE.fullmatch(t) for t in tokens):
        return True
    if any(t in _NOISE_TOKENS for t in tokens):
        return True
    if len(tokens) >= 2:
        if len(set(tokens)) < len(tokens):  # a token repeats
            return True
        if tokens[-1] in _REGION_ABBREV:  # trailing state/region code
            return True
    return False

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
    for a, b in zip(toks, toks[1:], strict=False):
        if len(a) > 1 and len(b) > 1:
            counts[f"{a} {b}"] += 1

    ranked = sorted(
        ((term, cnt) for term, cnt in counts.items() if not is_noise_phrase(term)),
        key=lambda kv: (-kv[1], kv[0]),
    )
    return ranked[:limit]


# ---------------------------------------------------------------------------
# Light stemming + vocabulary (FEAT-26: better keyword coverage)
#
# Exact string matching makes the keyword signal brittle: "managing" in a job
# post won't match "managed"/"management" on a résumé, and a term that appears
# in the résumé but not in its top-N keywords is missed entirely. A conservative
# suffix-stripping stemmer (classic NLP, deterministic, no ML model) plus a
# full-text vocabulary set fix both without inflating scores.
# ---------------------------------------------------------------------------

# Longest suffixes first so "ing" is tried before "s", etc.
_STEM_SUFFIXES: tuple[str, ...] = tuple(
    sorted(
        (
            "izations", "ization", "izing", "ements", "ement", "ations",
            "ation", "ingly", "ings", "ing", "edly", "ies", "ied", "ers",
            "ors", "er", "or", "ness", "ities", "ity", "ments", "ment", "ed",
            "es", "ly", "s",
        ),
        key=len,
        reverse=True,
    )
)


def stem(token: str) -> str:
    """Collapse a word to a crude stem so inflections match.

    Conservative on purpose: skill tokens bearing punctuation (``c++``,
    ``node.js``, ``ci/cd``) and very short words are returned untouched. A
    single suffix is stripped, then a trailing ``e`` is dropped so
    ``manage``/``managing``/``management``/``managed`` all fold to ``manag``.
    """
    if len(token) <= 4 or any(c in token for c in ".+#/_-"):
        return token
    for suffix in _STEM_SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            token = token[: -len(suffix)]
            break
    if len(token) > 3 and token.endswith("e"):
        token = token[:-1]
    return token


def stem_term(term: str) -> str:
    """Stem each word of a (possibly multi-word) term."""
    return " ".join(stem(part) for part in term.split(" "))


def vocabulary(text: str) -> set[str]:
    """All stemmed content terms (unigrams + bigrams) present in ``text``.

    Used as the *present* set when scoring keyword coverage so a job keyword is
    credited whenever it appears anywhere in the résumé — not just in the
    résumé's top-ranked keywords — and across inflectional variants.
    """
    toks = [
        t
        for t in _tokens(normalize(text))
        if t not in STOPWORDS and not t.isdigit() and len(t) > 1
    ]
    stems = [stem(t) for t in toks]
    vocab: set[str] = set(stems)
    for a, b in zip(stems, stems[1:], strict=False):
        vocab.add(f"{a} {b}")
    # Fold in canonical skills so a job keyword that is really a skill still
    # matches even though skills are stored unstemmed.
    for canonical in extract_skills(text):
        vocab.add(canonical)
        vocab.add(stem_term(canonical))
    return vocab


def content_tokens(text: str) -> list[str]:
    """Content word-tokens: stopwords, digits, and single chars removed."""
    return [
        t
        for t in _tokens(normalize(text))
        if t not in STOPWORDS and not t.isdigit() and len(t) > 1
    ]


# Clause/list separators that bound a keyphrase. Slashes and hyphens are kept
# so skill tokens (tcp/ip, ci/cd, ticket-based) survive.
_PHRASE_SPLIT_RE = re.compile(r"[,.;:()\[\]{}!?\"'|\n]+")


def candidate_phrases(
    text: str, *, max_words: int = 4, drop_noise: bool = True
) -> Counter[str]:
    """Domain-agnostic keyphrase candidates (RAKE-style), with frequencies.

    The text is split on punctuation *and* stopwords; each remaining contiguous
    run of content tokens is one candidate keyphrase (capped at ``max_words``),
    and its constituent unigrams are also counted. This preserves multi-word
    terms like ``specimen collection`` or ``local area network`` in *any* field
    without a per-domain list, while punctuation splitting keeps comma-separated
    list items ("assessment, medication administration") from fusing into one
    bogus phrase.

    ``drop_noise`` filters scraped page-chrome (see ``is_noise_phrase``); pass
    ``False`` to measure how much noise was present (``noise_rate``).
    """
    counts: Counter[str] = Counter()

    def flush(run: list[str]) -> None:
        if not run:
            return
        phrase = " ".join(run[:max_words])
        if not (drop_noise and is_noise_phrase(phrase)):
            counts[phrase] += 1
        for word in run:
            if len(word) > 1 and not (drop_noise and is_noise_phrase(word)):
                counts[word] += 1

    for fragment in _PHRASE_SPLIT_RE.split(normalize(text)):
        run: list[str] = []
        for tok in _tokens(fragment):
            if tok in STOPWORDS or tok.isdigit() or len(tok) <= 1:
                flush(run)
                run = []
            else:
                run.append(tok)
        flush(run)
    return counts


def noise_rate(text: str) -> float:
    """Share of a posting's salient phrases that look like scraped chrome.

    A high rate means navigation/footer/related-job text leaked past the
    structural and boundary filters, so the extracted terms — and the resulting
    score — are less trustworthy (FEAT-31). Measured over the *raw* RAKE
    candidates (before the noise filter drops them) so it reflects how much junk
    was present, not how much survived.
    """
    raw = candidate_phrases(text, drop_noise=False)
    total = sum(raw.values())
    if not total:
        return 0.0
    noisy = sum(count for phrase, count in raw.items() if is_noise_phrase(phrase))
    return round(noisy / total, 4)


def stemmed_ngrams(text: str, *, max_words: int = 3) -> set[str]:
    """Stemmed contiguous n-grams over the content-token stream.

    Used as the *present* set when matching a job phrase against a résumé so
    ``specimen collection`` matches ``specimen collections`` (stemming) and
    survives intervening stopwords being removed on both sides.
    """
    stems = [stem(t) for t in content_tokens(text)]
    out: set[str] = set()
    n = len(stems)
    for size in range(1, max_words + 1):
        for i in range(0, n - size + 1):
            out.add(" ".join(stems[i : i + size]))
    return out


def stemmed_unigrams(text: str) -> set[str]:
    """Set of stemmed content unigrams — for unordered 'all words present' checks."""
    return {stem(t) for t in content_tokens(text)}


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
