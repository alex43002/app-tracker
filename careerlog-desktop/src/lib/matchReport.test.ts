import { describe, expect, it } from "vitest";

import { buildMatchReport, matchReportFilename, scoreVerdict } from "./matchReport";
import type { MatchScore, TermMatch } from "../types/match";

function term(over: Partial<TermMatch> & { term: string }): TermMatch {
  return {
    status: "strong",
    bucket: "required",
    isConcept: true,
    evidence: [],
    ...over,
  };
}

function makeScore(over: Partial<MatchScore> = {}): MatchScore {
  return {
    score: 62,
    confidence: "high",
    confidenceReason: "Parsed 12 requirement terms from the posting.",
    skillSignalAvailable: true,
    contamination: "low",
    roleFamilies: ["Software engineering"],
    coverage: { required: 0.6, responsibility: 0.5, preferred: 0.2, concept: 0.55, keyword: 0.4 },
    strengths: [
      term({ term: "python", status: "strong", evidence: ["python"] }),
      term({ term: "django", status: "partial", bucket: "responsibility", evidence: ["django dev"] }),
    ],
    gaps: [
      term({ term: "aws", status: "missing", bucket: "required" }),
      term({ term: "kubernetes", status: "missing", bucket: "preferred" }),
    ],
    resume: { skills: ["python"], keywords: [] },
    job: { skills: ["python", "aws"], keywords: [] },
    ...over,
  };
}

const CTX = {
  jobTitle: "Backend Engineer",
  company: "Acme",
  resumeLabel: "cv.pdf",
  jobSourceLabel: "Pasted description",
  generatedAt: new Date("2026-07-05T12:00:00Z"),
};

describe("scoreVerdict", () => {
  it("bands the score at the documented thresholds", () => {
    expect(scoreVerdict(75).band).toBe("strong");
    expect(scoreVerdict(74).band).toBe("partial");
    expect(scoreVerdict(50).band).toBe("partial");
    expect(scoreVerdict(49).band).toBe("weak");
  });
});

describe("buildMatchReport", () => {
  it("summarizes verdict, confidence, and per-section coverage", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    expect(report.summary).toContain("Partial match (62/100)");
    expect(report.summary).toContain("high confidence");
    expect(report.summary).toContain("required 60%");
    expect(report.coverage.find((c) => c.label === "Required")?.pct).toBe(60);
  });

  it("orders recommendations: required gaps, then partials, then other gaps", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    expect(report.recommendations[0]).toContain("aws"); // required gap first
    expect(report.recommendations[1]).toContain("django"); // partial strength
    expect(report.recommendations[2]).toContain("kubernetes"); // other gap
    expect(report.recommendations.at(-1)).toContain("Tailor, don't pad");
  });

  it("flags required gaps distinctly from other gaps", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    expect(report.gaps.find((g) => g.term === "aws")?.required).toBe(true);
    expect(report.gaps.find((g) => g.term === "kubernetes")?.required).toBe(false);
  });

  it("reports N/A skills and a keyword-based note when no concepts were recognized", () => {
    const noConcepts = makeScore({
      skillSignalAvailable: false,
      coverage: { required: 0.5, responsibility: 0.4, preferred: null, concept: null, keyword: 0.3 },
    });
    const report = buildMatchReport({ result: noConcepts, ...CTX });
    expect(report.summary).toContain("N/A");
    expect(report.coverage.find((c) => c.label === "Recognized skills")?.pct).toBeNull();
    expect(report.coverage.find((c) => c.label === "Preferred")?.pct).toBeNull();
  });

  it("gives a positive recommendation when nothing is missing", () => {
    const report = buildMatchReport({
      result: makeScore({ gaps: [], strengths: [term({ term: "python", evidence: ["python"] })] }),
      ...CTX,
    });
    expect(report.recommendations[0].toLowerCase()).toContain("covers what the posting");
  });

  it("carries role family and confidence into the metadata", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    const meta = Object.fromEntries(report.meta.map((m) => [m.label, m.value]));
    expect(meta.Position).toBe("Backend Engineer — Acme");
    expect(meta["Read as"]).toBe("Software engineering");
    expect(meta["Parse confidence"]).toBe("high");
  });
});

describe("matchReportFilename", () => {
  it("slugifies the company and role with a date", () => {
    const name = matchReportFilename({
      jobTitle: "Backend Engineer",
      company: "Acme, Inc.",
      generatedAt: new Date("2026-07-05T00:00:00Z"),
    });
    expect(name).toBe("match-report-acme-inc-backend-engineer-2026-07-05.pdf");
  });

  it("still produces a valid name with no position", () => {
    const name = matchReportFilename({ generatedAt: new Date("2026-07-05T00:00:00Z") });
    expect(name).toBe("match-report-2026-07-05.pdf");
  });
});
