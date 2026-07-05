import { describe, expect, it } from "vitest";

import {
  buildMatchReport,
  matchReportFilename,
  scoreVerdict,
} from "./matchReport";
import type { MatchScore } from "../types/match";

function makeScore(overrides: Partial<MatchScore["breakdown"]> = {}, score = 62): MatchScore {
  const breakdown = {
    skillCoverage: 0.6,
    keywordCoverage: 0.5,
    matchedSkills: ["python", "django"],
    missingSkills: ["aws", "kubernetes"],
    matchedKeywords: ["payments"],
    missingKeywords: ["terraform"],
    ...overrides,
  };
  return {
    score,
    breakdown,
    gaps: [...breakdown.missingSkills, ...breakdown.missingKeywords],
    resume: { skills: breakdown.matchedSkills, keywords: breakdown.matchedKeywords },
    job: { skills: [], keywords: [] },
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
    expect(scoreVerdict(0).band).toBe("weak");
  });
});

describe("buildMatchReport", () => {
  it("explains the score with skill counts and weighting", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    expect(report.summary).toContain("2 of 4 required skills");
    expect(report.summary).toContain("70%");
    expect(report.summary).toContain("30%");
    expect(report.coverage[0]).toMatchObject({ matched: 2, required: 4, pct: 60 });
  });

  it("orders recommendations with missing skills before keywords", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    expect(report.recommendations[0]).toContain("aws");
    expect(report.recommendations[0]).toContain("kubernetes");
    expect(report.recommendations[1]).toContain("terraform");
  });

  it("gives a positive recommendation when nothing is missing", () => {
    const perfect = makeScore(
      { missingSkills: [], missingKeywords: [], skillCoverage: 1, keywordCoverage: 1 },
      100
    );
    const report = buildMatchReport({ result: perfect, ...CTX });
    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0].toLowerCase()).toContain("covers everything");
  });

  it("falls back to keyword-only wording when the posting yields no skills", () => {
    const noSkills = makeScore(
      { matchedSkills: [], missingSkills: [], skillCoverage: 1, keywordCoverage: 0.4 },
      40
    );
    const report = buildMatchReport({ result: noSkills, ...CTX });
    expect(report.summary).toContain("didn't yield recognizable skills");
    expect(report.summary).toContain("40%");
    expect(report.coverage[0].required).toBe(0);
  });

  it("includes the position and résumé source in the metadata", () => {
    const report = buildMatchReport({ result: makeScore(), ...CTX });
    const meta = Object.fromEntries(report.meta.map((m) => [m.label, m.value]));
    expect(meta.Position).toBe("Backend Engineer — Acme");
    expect(meta.Résumé).toBe("cv.pdf");
    expect(meta["Job description"]).toBe("Pasted description");
  });

  it("summarizes long recommendation lists instead of naming every term", () => {
    const many = makeScore({
      missingSkills: ["a", "b", "c", "d", "e", "f", "g", "h"],
    });
    const report = buildMatchReport({ result: many, ...CTX });
    expect(report.recommendations[0]).toContain("and 2 more");
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
