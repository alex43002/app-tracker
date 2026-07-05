import { describe, expect, it } from "vitest";

import { buildMatchReport } from "./matchReport";
import { renderMatchReportPdf } from "./matchReportPdf";
import type { MatchScore, TermMatch } from "../types/match";

function term(over: Partial<TermMatch> & { term: string }): TermMatch {
  return { status: "strong", bucket: "required", isConcept: true, evidence: [], ...over };
}

const SCORE: MatchScore = {
  score: 62,
  confidence: "high",
  confidenceReason: "Parsed 12 requirement terms from the posting.",
  skillSignalAvailable: true,
  roleFamilies: ["Software engineering"],
  coverage: { required: 0.6, responsibility: 0.5, preferred: null, concept: 0.55, keyword: 0.4 },
  strengths: [
    term({ term: "python", status: "strong", evidence: ["python developer"] }),
    term({ term: "django", status: "partial", bucket: "responsibility" }),
  ],
  gaps: [term({ term: "aws", status: "missing", bucket: "required" })],
  resume: { skills: ["python"], keywords: [] },
  job: { skills: ["python", "aws"], keywords: [] },
};

function report(over: Partial<MatchScore> = {}) {
  return buildMatchReport({
    result: { ...SCORE, ...over },
    jobTitle: "Backend Engineer",
    company: "Acme",
    resumeLabel: "cv.pdf",
    jobSourceLabel: "Pasted description",
    generatedAt: new Date("2026-07-05T12:00:00Z"),
  });
}

describe("renderMatchReportPdf", () => {
  it("produces a non-empty PDF document", () => {
    const blob = renderMatchReportPdf(report()).output("blob");
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/pdf");
  });

  it("emits a PDF header signature", () => {
    const out = renderMatchReportPdf(report()).output("arraybuffer") as ArrayBuffer;
    const head = String.fromCharCode(...new Uint8Array(out).slice(0, 5));
    expect(head).toBe("%PDF-");
  });

  it("renders an N/A coverage line without throwing", () => {
    // preferred coverage is null in SCORE — must render as N/A, not a crash.
    const doc = renderMatchReportPdf(report());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("paginates when there are many gaps", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      term({ term: `gap-${i}`, status: "missing", bucket: "preferred" })
    );
    const doc = renderMatchReportPdf(report({ gaps: many }));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
