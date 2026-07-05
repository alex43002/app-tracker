import { describe, expect, it } from "vitest";

import { buildMatchReport } from "./matchReport";
import { renderMatchReportPdf } from "./matchReportPdf";
import type { MatchScore } from "../types/match";

const SCORE: MatchScore = {
  score: 62,
  breakdown: {
    skillCoverage: 0.6,
    keywordCoverage: 0.5,
    matchedSkills: ["python", "django"],
    missingSkills: ["aws", "kubernetes"],
    matchedKeywords: ["payments"],
    missingKeywords: ["terraform"],
  },
  gaps: ["aws", "kubernetes", "terraform"],
  resume: { skills: ["python", "django"], keywords: ["payments"] },
  job: { skills: [], keywords: [] },
};

function report() {
  return buildMatchReport({
    result: SCORE,
    jobTitle: "Backend Engineer",
    company: "Acme",
    resumeLabel: "cv.pdf",
    jobSourceLabel: "Pasted description",
    generatedAt: new Date("2026-07-05T12:00:00Z"),
  });
}

describe("renderMatchReportPdf", () => {
  it("produces a non-empty PDF document", () => {
    const doc = renderMatchReportPdf(report());
    const blob = doc.output("blob");
    expect(blob.size).toBeGreaterThan(0);
    // jsPDF sets the correct mime type on the emitted blob.
    expect(blob.type).toBe("application/pdf");
  });

  it("emits a PDF header signature", () => {
    const doc = renderMatchReportPdf(report());
    const out = doc.output("arraybuffer") as ArrayBuffer;
    const head = String.fromCharCode(...new Uint8Array(out).slice(0, 5));
    expect(head).toBe("%PDF-");
  });

  it("does not throw when many terms force a second page", () => {
    const big = {
      ...SCORE,
      breakdown: {
        ...SCORE.breakdown,
        missingKeywords: Array.from({ length: 200 }, (_, i) => `term-${i}`),
      },
    };
    const model = buildMatchReport({
      result: big,
      resumeLabel: "cv.pdf",
      jobSourceLabel: "Pasted description",
    });
    const doc = renderMatchReportPdf(model);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
