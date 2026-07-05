import type { CoverageInfo, MatchScore, MatchStatus, TermMatch } from "../types/match";

/* ============================================================
   Match report model (FEAT-21)

   Pure logic that turns a MatchScore into an explainable report:
   the verdict + parse confidence, *why* the score landed where it
   did (per-section coverage), what went well (with the résumé
   evidence that earned it), what's missing (required first), and
   honest, non-padding recommendations. No rendering here so it can
   be unit-tested and shared by the on-screen result and the PDF.
============================================================ */

export type ScoreBand = "strong" | "partial" | "weak";

export interface ScoreVerdict {
  band: ScoreBand;
  label: string;
}

export const STRONG_MATCH_MIN = 75;
export const PARTIAL_MATCH_MIN = 50;

/** Map a 0–100 score to its band + human label. */
export function scoreVerdict(score: number): ScoreVerdict {
  if (score >= STRONG_MATCH_MIN) return { band: "strong", label: "Strong match" };
  if (score >= PARTIAL_MATCH_MIN) return { band: "partial", label: "Partial match" };
  return { band: "weak", label: "Weak match" };
}

export interface CoverageLine {
  label: string;
  /** Percent 0..100, or null when the posting had no such section (N/A). */
  pct: number | null;
}

export interface ReportStrength {
  term: string;
  status: MatchStatus;
  evidence: string[];
}

export interface ReportGap {
  term: string;
  required: boolean;
}

export interface MatchReportInput {
  result: MatchScore;
  jobTitle?: string;
  company?: string;
  resumeLabel: string;
  jobSourceLabel: string;
  generatedAt?: Date;
}

export interface MatchReport {
  generatedAt: Date;
  meta: { label: string; value: string }[];
  score: number;
  verdict: ScoreVerdict;
  confidence: MatchScore["confidence"];
  roleFamilies: string[];
  summary: string;
  coverage: CoverageLine[];
  strengths: ReportStrength[];
  gaps: ReportGap[];
  recommendations: string[];
}

const MAX_NAMED_TERMS = 6;

function pct(fraction: number | null): number | null {
  return fraction === null ? null : Math.round(fraction * 100);
}

function joinTerms(terms: string[], limit: number): string {
  const named = terms.slice(0, limit);
  const rest = terms.length - named.length;
  const list = named.join(", ");
  return rest > 0 ? `${list}, and ${rest} more` : list;
}

function coverageText(cov: CoverageInfo): string {
  const parts: string[] = [];
  if (cov.required !== null) parts.push(`required ${pct(cov.required)}%`);
  if (cov.responsibility !== null) parts.push(`responsibilities ${pct(cov.responsibility)}%`);
  if (cov.preferred !== null) parts.push(`preferred ${pct(cov.preferred)}%`);
  return parts.join(", ");
}

/** Build the full, explainable report model from a score + its context. */
export function buildMatchReport(input: MatchReportInput): MatchReport {
  const { result } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const verdict = scoreVerdict(result.score);

  const meta: { label: string; value: string }[] = [];
  const role = [input.jobTitle, input.company].filter(Boolean).join(" — ");
  if (role) meta.push({ label: "Position", value: role });
  meta.push({ label: "Résumé", value: input.resumeLabel });
  meta.push({ label: "Job description", value: input.jobSourceLabel });
  if (result.roleFamilies.length > 0) {
    meta.push({ label: "Read as", value: result.roleFamilies.join(" · ") });
  }
  meta.push({ label: "Parse confidence", value: result.confidence });
  meta.push({ label: "Generated", value: generatedAt.toLocaleString() });

  const covText = coverageText(result.coverage);
  const summary =
    `${verdict.label} (${result.score}/100), parsed with ${result.confidence} ` +
    `confidence. ${result.confidenceReason}` +
    (covText ? ` Coverage — ${covText}.` : "") +
    (result.skillSignalAvailable
      ? ""
      : " The recognized-skills signal is N/A for this field, so this is a keyword-based estimate.");

  const coverage: CoverageLine[] = [
    { label: "Required", pct: pct(result.coverage.required) },
    { label: "Responsibilities", pct: pct(result.coverage.responsibility) },
    { label: "Preferred", pct: pct(result.coverage.preferred) },
    { label: "Recognized skills", pct: pct(result.coverage.concept) },
  ];

  const strengths: ReportStrength[] = result.strengths.map((m: TermMatch) => ({
    term: m.term,
    status: m.status,
    evidence: m.evidence,
  }));

  const gaps: ReportGap[] = result.gaps.map((m) => ({
    term: m.term,
    required: m.bucket === "required",
  }));

  const requiredGaps = result.gaps.filter((g) => g.bucket === "required").map((g) => g.term);
  const otherGaps = result.gaps.filter((g) => g.bucket !== "required").map((g) => g.term);
  const partials = result.strengths
    .filter((s) => s.status === "partial" || s.status === "foundational")
    .map((s) => s.term);

  // Recommendations — honest and evidence-aware; never "just add these".
  const recommendations: string[] = [];
  if (requiredGaps.length > 0) {
    recommendations.push(
      `Prioritize the required items the posting lists that your résumé doesn't ` +
        `evidence: ${joinTerms(requiredGaps, MAX_NAMED_TERMS)}. Add them only if you ` +
        `genuinely have the experience.`
    );
  }
  if (partials.length > 0) {
    recommendations.push(
      `You partially match ${joinTerms(partials, MAX_NAMED_TERMS)} — strengthen these ` +
        `with concrete, quantified examples so they read as full experience.`
    );
  }
  if (otherGaps.length > 0) {
    recommendations.push(
      `Where accurate, mirror the posting's wording for: ` +
        `${joinTerms(otherGaps, MAX_NAMED_TERMS)}.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Your résumé covers what the posting asks for. Mirror its exact phrasing to " +
        "stay ahead of keyword screens."
    );
  } else {
    recommendations.push("Tailor, don't pad — only claim skills you can back up in an interview.");
  }

  return {
    generatedAt,
    meta,
    score: result.score,
    verdict,
    confidence: result.confidence,
    roleFamilies: result.roleFamilies,
    summary,
    coverage,
    strengths,
    gaps,
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
  return slug ? `match-report-${slug}-${date}.pdf` : `match-report-${date}.pdf`;
}
