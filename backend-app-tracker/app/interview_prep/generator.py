"""Turn a job description into role-specific prep material (no generative AI).

This is deterministic, template-driven prep — *not* an LLM. It reuses the
matching engine's keyword/skill extraction (FEAT-21) to find what the role
emphasizes, then assembles:

* **topics** — the skills + themes the posting stresses, ranked by salience;
* **technical questions** — curated per-skill prompts (with a generic fallback
  for skills the bank doesn't cover);
* **behavioral questions** — surfaced from the soft skills the posting mentions,
  plus a standing set of common behavioral prompts;
* **notes** — a short, plain-language briefing on where to focus.

Every output is a fixed function of the input text, so it's stable and
explainable.
"""

from __future__ import annotations

from app.matching.keywords import extract_keywords, extract_skills

# Curated practice questions for popular skills. Anything not here falls back to
# the generic templates below, so coverage degrades gracefully.
SKILL_QUESTIONS: dict[str, list[str]] = {
    "python": [
        "Walk through a non-trivial Python project you built. What were the key design decisions?",
        "How do you manage dependencies and virtual environments across projects?",
        "When would you reach for a generator over a list, and why?",
    ],
    "javascript": [
        "Explain the event loop and how async/await works on top of it.",
        "How do closures work, and where have you used them deliberately?",
    ],
    "typescript": [
        "What problems does TypeScript solve for you over plain JavaScript?",
        "Explain the difference between `type` and `interface`, and when you'd pick each.",
    ],
    "react": [
        "How do you decide what belongs in state vs. derived from props?",
        "Walk through how you'd debug an unnecessary re-render.",
        "When do you reach for useEffect, and what mistakes do you watch for?",
    ],
    "sql": [
        "How would you diagnose and fix a slow query?",
        "Explain the difference between an inner join and a left join with an example.",
    ],
    "aws": [
        "Describe an architecture you've deployed on AWS and why you chose those services.",
        "How do you think about cost vs. reliability when designing on AWS?",
    ],
    "docker": [
        "What goes into a production-ready Dockerfile, and how do you keep images small?",
        "How do you debug a container that won't start?",
    ],
    "kubernetes": [
        "Explain how a Deployment, a Service, and an Ingress fit together.",
        "How do you roll out a change safely and roll it back if it fails?",
    ],
    "machine learning": [
        "How do you tell whether a model is overfitting, and what do you do about it?",
        "Walk through how you'd frame a business problem as an ML task.",
    ],
    "system design": [
        "Design a URL shortener. How does your design change at 10x scale?",
        "How do you reason about consistency vs. availability in a distributed system?",
    ],
}

# Skill -> generic technical prompts use {skill} substitution.
GENERIC_SKILL_QUESTIONS: tuple[str, ...] = (
    "Walk me through a project where you used {skill}. What was your specific contribution?",
    "What are common pitfalls when working with {skill}, and how do you avoid them?",
    "How would you explain {skill} to a teammate who's new to it?",
)

# Canonical skills that signal a behavioral, rather than technical, focus.
SOFT_SKILLS: frozenset[str] = frozenset(
    {
        "leadership",
        "teamwork",
        "communication",
        "problem solving",
        "mentoring",
        "project management",
        "product management",
        "stakeholder management",
        "agile",
        "scrum",
    }
)

BEHAVIORAL_QUESTIONS: dict[str, list[str]] = {
    "leadership": [
        "Tell me about a time you led a project or initiative. How did you keep it on track?",
        "Describe a moment you had to make an unpopular decision.",
    ],
    "teamwork": [
        "Tell me about a time you resolved a disagreement within your team.",
    ],
    "communication": [
        "Describe a time you had to explain something technical to a non-technical audience.",
    ],
    "mentoring": [
        "Tell me about someone you mentored. How did you help them grow?",
    ],
    "project management": [
        "Describe a project you managed end to end. How did you handle scope and deadlines?",
    ],
    "product management": [
        "Tell me about a product decision you made with incomplete information.",
    ],
}

# Standing behavioral prompts every candidate should be ready for.
GENERIC_BEHAVIORAL: tuple[str, ...] = (
    "Tell me about a significant challenge you faced at work and how you handled it.",
    "Describe a time you failed. What did you learn?",
    "Tell me about a project you're especially proud of.",
    "Why are you interested in this role?",
)

MAX_SKILL_TOPICS = 10
MAX_THEME_TOPICS = 6
MAX_TECHNICAL_QUESTIONS = 12
MAX_BEHAVIORAL_QUESTIONS = 8


def _theme_keywords(text: str, skills: list[str]) -> list[str]:
    """Top ranked keywords that aren't already captured as skills."""
    skill_set = set(skills)
    out: list[str] = []
    for term, _count in extract_keywords(text, limit=40):
        if term in skill_set:
            continue
        out.append(term)
        if len(out) >= MAX_THEME_TOPICS:
            break
    return out


def _technical_questions(skills: list[str]) -> list[str]:
    questions: list[str] = []
    seen: set[str] = set()
    for skill in skills:
        if skill in SOFT_SKILLS:
            continue
        prompts = SKILL_QUESTIONS.get(skill)
        if prompts is None:
            prompts = [q.format(skill=skill) for q in GENERIC_SKILL_QUESTIONS[:1]]
        for prompt in prompts:
            if prompt not in seen:
                seen.add(prompt)
                questions.append(prompt)
            if len(questions) >= MAX_TECHNICAL_QUESTIONS:
                return questions
    return questions


def _behavioral_questions(skills: list[str]) -> list[str]:
    questions: list[str] = []
    seen: set[str] = set()
    for skill in skills:
        for prompt in BEHAVIORAL_QUESTIONS.get(skill, []):
            if prompt not in seen:
                seen.add(prompt)
                questions.append(prompt)
    for prompt in GENERIC_BEHAVIORAL:
        if prompt not in seen and len(questions) < MAX_BEHAVIORAL_QUESTIONS:
            seen.add(prompt)
            questions.append(prompt)
    return questions[:MAX_BEHAVIORAL_QUESTIONS]


def _notes(job_title: str | None, skills: list[str], themes: list[str]) -> str:
    role = (job_title or "").strip() or "this role"
    tech = [s for s in skills if s not in SOFT_SKILLS][:5]
    soft = [s for s in skills if s in SOFT_SKILLS][:4]

    parts: list[str] = []
    if tech:
        parts.append(
            f"{role} leans on {', '.join(tech)}. Be ready to go deep on these — "
            "have concrete examples and tradeoffs in mind."
        )
    else:
        parts.append(
            f"The posting for {role} doesn't name many specific tools, so focus on "
            "your general experience and the themes below."
        )
    if themes:
        parts.append(f"Recurring themes to weave into your answers: {', '.join(themes)}.")
    if soft:
        parts.append(
            f"Expect behavioral rounds around {', '.join(soft)} — prepare STAR stories."
        )
    else:
        parts.append("Prepare a few STAR stories for the standard behavioral questions.")
    return " ".join(parts)


def generate_prep(job_description: str, job_title: str | None = None) -> dict:
    """Build prep topics, questions, and notes from a job description."""
    skills = extract_skills(job_description)[:MAX_SKILL_TOPICS]
    themes = _theme_keywords(job_description, skills)

    topics = [{"name": s, "kind": "skill"} for s in skills]
    topics += [{"name": t, "kind": "theme"} for t in themes]

    return {
        "topics": topics,
        "technicalQuestions": _technical_questions(skills),
        "behavioralQuestions": _behavioral_questions(skills),
        "notes": _notes(job_title, skills, themes),
    }
