import { jsPDF } from "jspdf";

import type { CoverageLine, MatchReport, ScoreBand } from "./matchReport";

/* ============================================================
   Match report → PDF (FEAT-21)

   Thin rendering layer over jsPDF. All wording/logic lives in
   matchReport.ts; this file only lays the model out on the page.
============================================================ */

type RGB = [number, number, number];

const BAND_COLOR: Record<ScoreBand, RGB> = {
  strong: [22, 163, 74],
  partial: [217, 119, 6],
  weak: [220, 38, 38],
};

const INK: RGB = [17, 24, 39];
const MUTED: RGB = [107, 114, 128];
const RULE: RGB = [229, 231, 235];
const GREEN: RGB = [22, 163, 74];
const RED: RGB = [220, 38, 38];

const PAGE = { width: 595, height: 842 }; // A4 in points
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

/** Render a match report model to a jsPDF document (does not save it). */
export function renderMatchReportPdf(report: MatchReport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const band = BAND_COLOR[report.verdict.band];
  let y = MARGIN;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const ensure = (needed: number) => {
    if (y + needed > PAGE.height - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const paragraph = (
    text: string,
    opts: { size?: number; color?: RGB; gap?: number; indent?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setColor(opts.color ?? INK);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, MARGIN + indent, y);
      y += lineHeight;
    }
    y += opts.gap ?? 0;
  };

  const sectionHeading = (text: string) => {
    ensure(28);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setColor(INK);
    doc.text(text, MARGIN, y);
    y += 6;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    y += 14;
  };

  // ---- Header: title + score badge ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setColor(INK);
  doc.text("Résumé match report", MARGIN, y);

  const badgeR = 26;
  const badgeX = PAGE.width - MARGIN - badgeR;
  const badgeY = y - 6;
  doc.setFillColor(band[0], band[1], band[2]);
  doc.circle(badgeX, badgeY, badgeR, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(String(report.score), badgeX, badgeY + 6, { align: "center" });

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(band);
  doc.text(
    `${report.verdict.label}  ·  ${report.confidence} confidence`,
    MARGIN,
    y,
  );
  y += 14;
  if (report.roleFamilies.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(MUTED);
    doc.text(`Read as: ${report.roleFamilies.join(" · ")}`, MARGIN, y);
    y += 14;
  }

  // ---- Meta table ----
  doc.setFontSize(10);
  for (const row of report.meta) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    setColor(MUTED);
    doc.text(`${row.label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    setColor(INK);
    const value = doc.splitTextToSize(
      row.value,
      CONTENT_WIDTH - 110,
    ) as string[];
    doc.text(value, MARGIN + 100, y);
    y += Math.max(16, value.length * 13);
  }

  // ---- Summary (the "why") ----
  sectionHeading("Summary");
  paragraph(report.summary, { gap: 4 });

  // ---- Coverage ----
  sectionHeading("Coverage");
  const coverageBar = (line: CoverageLine) => {
    ensure(28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(INK);
    doc.text(line.label, MARGIN, y);
    setColor(MUTED);
    doc.text(
      line.pct === null ? "N/A" : `${line.pct}%`,
      MARGIN + CONTENT_WIDTH,
      y,
      {
        align: "right",
      },
    );
    y += 8;
    const barH = 6;
    doc.setFillColor(RULE[0], RULE[1], RULE[2]);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, barH, 3, 3, "F");
    if (line.pct !== null && line.pct > 0) {
      doc.setFillColor(band[0], band[1], band[2]);
      doc.roundedRect(
        MARGIN,
        y,
        (line.pct / 100) * CONTENT_WIDTH,
        barH,
        3,
        3,
        "F",
      );
    }
    y += barH + 14;
  };
  report.coverage.forEach(coverageBar);

  // ---- What you match (with evidence) ----
  sectionHeading("What you match");
  if (report.strengths.length === 0) {
    paragraph("Nothing from the posting was found in your résumé.", {
      color: MUTED,
    });
  } else {
    for (const s of report.strengths.slice(0, 30)) {
      ensure(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor(GREEN);
      doc.text(`[${s.status}]`, MARGIN, y);
      doc.setFont("helvetica", "normal");
      setColor(INK);
      doc.text(s.term, MARGIN + 66, y);
      y += 13;
      if (s.evidence.length > 0) {
        paragraph(`via ${s.evidence.slice(0, 4).join(", ")}`, {
          size: 8,
          color: MUTED,
          indent: 66,
          gap: 2,
        });
      }
    }
  }

  // ---- Gaps ----
  sectionHeading("Gaps");
  const requiredGaps = report.gaps.filter((g) => g.required).map((g) => g.term);
  const otherGaps = report.gaps.filter((g) => !g.required).map((g) => g.term);
  if (report.gaps.length === 0) {
    paragraph("None — your résumé covers what the posting asks for.", {
      color: MUTED,
    });
  } else {
    if (requiredGaps.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor(RED);
      ensure(14);
      doc.text("Required, and missing:", MARGIN, y);
      y += 13;
      paragraph(requiredGaps.join(", "), { gap: 4 });
    }
    if (otherGaps.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor(MUTED);
      ensure(14);
      doc.text("Also missing:", MARGIN, y);
      y += 13;
      paragraph(otherGaps.join(", "), { color: MUTED, gap: 4 });
    }
  }

  // ---- Recommendations ----
  sectionHeading("Recommendations");
  for (const rec of report.recommendations) {
    ensure(16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(INK);
    const lines = doc.splitTextToSize(rec, CONTENT_WIDTH - 14) as string[];
    doc.text("•", MARGIN, y);
    for (const line of lines) {
      ensure(14);
      doc.text(line, MARGIN + 14, y);
      y += 14;
    }
    y += 4;
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(
      "Generated by CareerLog · estimated fit from section-weighted skill & keyword coverage",
      MARGIN,
      PAGE.height - 24,
    );
    doc.text(`${p} / ${pages}`, PAGE.width - MARGIN, PAGE.height - 24, {
      align: "right",
    });
  }

  return doc;
}
