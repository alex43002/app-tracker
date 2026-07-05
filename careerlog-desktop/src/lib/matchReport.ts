import type { MatchScore } from "../types/match";

/* ============================================================
   Match report model (FEAT-21)

   Pure logic that turns a raw MatchScore into an explainable
   report — the verdict, *why* the score is what it is, what went
   well, what went wrong, and what to do next. Kept free of any
   rendering (React or PDF) so it can be unit-tested and reused by
   both the on-screen result and the exported PDF.
============================================================ */

/** Score band shared by the on-screen result and the PDF, so they never drift. */
export type ScoreBand = "strong" | "partial" | "weak";

export interface ScoreVerdict {
  band: ScoreBand;
  label: string;
}

// Thresholds live here (single source of truth) — ScoreResult and the PDF both
// read them via scoreVerdict rather than hard-coding their own cutoffs.
export const STRONG_MATCH_MIN = 75;
export const PARTIAL_MATCH_MIN = 50;

/** Map a 0–100 score to its band + human label. */
export function scoreVerdict(score: number): ScoreVerdict {
  if (score >= STRONG_MATCH_MIN) return { band: "strong", label: "Strong match" };
  if (score >= PARTIAL_MATCH_MIN) return { band: "partial", label: "Partial match" };
  return { band: "weak", label: "Weak match" };
}

/** A coverage signal (skills or keywords) with the counts behind it. */
export interface CoverageLine {
  label: string;
  pct: number; // 0..100
  matched: number;
  required: number;
  weightPct: number; // this signal's share of the blended score
}

/** A named group of terms (matched skills, missing keywords, …). */
export interface TermGroup {
  heading: string;
  terms: string[];
}

export interface MatchReportInput {
  result: MatchScore;
  jobTitle?: string;
  company?: string;
  /** How the résumé was supplied, e.g. a filename or "Saved résumé". */
  resumeLabel: string;
  /** How the job text was supplied, e.g. "Scraped from posting URL". */
  jobSourceLabel: string;
  generatedAt?: Date;
}

export interface MatchReport {
  generatedAt: Date;
  meta: { label: string; value: string }[];
  score: number;
  verdict: ScoreVerdict;
  /** One or two sentences explaining *why* the score landed where it did. */
  summary: string;
  coverage: CoverageLine[];
  strengths: TermGroup[];
  weaknesses: TermGroup[];
  recommendations: string[];
}

// The blended score weights skills at 70% and keywords at 30% (mirrors the
// backend's scoring.py). Surfaced in the report so the "why" is honest.
const SKILL_WEIGHT_PCT = 70;
const KEYWORD_WEIGHT_PCT = 30;
// How many terms to name in the recommendation sentences before summarizing.
const MAX_NAMED_RECOMMENDATIONS = 6;

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

function joinTerms(terms: string[], limit: number): string {
  const named = terms.slice(0, limit);
  const rest = terms.length - named.length;
  const list = named.join(", ");
  return rest > 0 ? `${list}, and ${rest} more` : list;
}

/** Build the full, explainable report model from a score + its context. */
export function buildMatchReport(input: MatchReportInput): MatchReport {
  const { result } = input;
  const b = result.breakdown;
  const generatedAt = input.generatedAt ?? new Date();

  const matchedSkills = b.matchedSkills.length;
  const requiredSkills = matchedSkills + b.missingSkills.length;
  const matchedKeywords = b.matchedKeywords.length;
  const requiredKeywords = matchedKeywords + b.missingKeywords.length;

  const meta: { label: string; value: string }[] = [];
  const role = [input.jobTitle, input.company].filter(Boolean).join(" — ");
  if (role) meta.push({ label: "Position", value: role });
  meta.push({ label: "Résumé", value: input.resumeLabel });
  meta.push({ label: "Job description", value: input.jobSourceLabel });
  meta.push({ label: "Generated", value: generatedAt.toLocaleString() });

  const verdict = scoreVerdict(result.score);

  // "Why" — honest about what drove the number, adapting to the taxonomy cases
  // the backend handles (no skills detected → keyword-only scoring).
  let summary: string;
  if (requiredSkills === 0) {
    summary =
      `This posting didn't yield recognizable skills, so the ${result.score}/100 ` +
      `score reflects keyword coverage alone (${pct(b.keywordCoverage)}% of the ` +
      `posting's salient terms).`;
  } else {
    summary =
      `This is a ${verdict.label.toLowerCase()} (${result.score}/100). Skills carry ` +
      `${SKILL_WEIGHT_PCT}% of the score: your résumé demonstrates ${matchedSkills} ` +
      `of ${requiredSkills} required skills (${pct(b.skillCoverage)}%). Keyword ` +
      `coverage — the remaining ${KEYWORD_WEIGHT_PCT}% — is ${pct(b.keywordCoverage)}%.`;
  }

  const coverage: CoverageLine[] = [
    {
      label: "Skill coverage",
      pct: pct(b.skillCoverage),
      matched: matchedSkills,
      required: requiredSkills,
      weightPct: SKILL_WEIGHT_PCT,
    },
    {
      label: "Keyword coverage",
      pct: pct(b.keywordCoverage),
      matched: matchedKeywords,
      required: requiredKeywords,
      weightPct: KEYWORD_WEIGHT_PCT,
    },
  ];

  const strengths: TermGroup[] = [
    { heading: "Skills you match", terms: b.matchedSkills },
    { heading: "Keywords you cover", terms: b.matchedKeywords },
  ];

  const weaknesses: TermGroup[] = [
    { heading: "Missing skills", terms: b.missingSkills },
    { heading: "Missing keywords", terms: b.missingKeywords },
  ];

  // Recommendations, ordered by impact: skills first (they weigh most).
  const recommendations: string[] = [];
  if (b.missingSkills.length > 0) {
    recommendations.push(
      `Add clear evidence of these skills (highest impact first): ` +
        `${joinTerms(b.missingSkills, MAX_NAMED_RECOMMENDATIONS)}.`
    );
  }
  if (b.missingKeywords.length > 0) {
    recommendations.push(
      `Work in terminology the posting emphasizes: ` +
        `${joinTerms(b.missingKeywords, MAX_NAMED_RECOMMENDATIONS)}.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Your résumé covers everything the posting asks for. Mirror the posting's " +
        "exact phrasing to stay ahead of keyword screens."
    );
  } else if (verdict.band !== "strong") {
    recommendations.push(
      "Only claim skills you can back up with concrete examples — tailor, don't pad."
    );
  }

  return {
    generatedAt,
    meta,
    score: result.score,
    verdict,
    summary,
    coverage,
    strengths,
    weaknesses,
    recommendations,
  };
}

/** Filesystem-friendly report name, e.g. `match-report-acme-backend-eng.pdf`. */
export function matchReportFilename(input: {
  jobTitle?: string;
  company?: string;
  generatedAt?: Date;
}): string {
  const slug = [input.company, input.jobTitle]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = (input.generatedAt ?? new Date()).toISOString().slice(0, 10);
  return slug
    ? `match-report-${slug}-${date}.pdf`
    : `match-report-${date}.pdf`;
}
