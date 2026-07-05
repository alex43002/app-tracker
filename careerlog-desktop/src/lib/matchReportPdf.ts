import { jsPDF } from "jspdf";

import type { MatchReport, ScoreBand, TermGroup } from "./matchReport";

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

const PAGE = { width: 595, height: 842 }; // A4 in points
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

/** Render a match report model to a jsPDF document (does not save it). */
export function renderMatchReportPdf(report: MatchReport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const band = BAND_COLOR[report.verdict.band];
  let y = MARGIN;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  /** Reserve vertical space, adding a page when the block wouldn't fit. */
  const ensure = (needed: number) => {
    if (y + needed > PAGE.height - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const paragraph = (
    text: string,
    opts: { size?: number; color?: RGB; gap?: number; bold?: boolean } = {}
  ) => {
    const size = opts.size ?? 10;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    setColor(opts.color ?? INK);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, MARGIN, y);
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
  doc.text(report.verdict.label, MARGIN, y);
  y += 18;

  // ---- Meta table ----
  doc.setFontSize(10);
  for (const row of report.meta) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    setColor(MUTED);
    doc.text(`${row.label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    setColor(INK);
    const value = doc.splitTextToSize(row.value, CONTENT_WIDTH - 110) as string[];
    doc.text(value, MARGIN + 100, y);
    y += Math.max(16, value.length * 13);
  }

  // ---- Summary (the "why") ----
  sectionHeading("Summary");
  paragraph(report.summary, { gap: 4 });

  // ---- Coverage ----
  sectionHeading("Coverage");
  for (const line of report.coverage) {
    ensure(30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(INK);
    doc.text(`${line.label} (${line.weightPct}% of score)`, MARGIN, y);
    setColor(MUTED);
    const detail =
      line.required > 0
        ? `${line.pct}%  ·  ${line.matched}/${line.required}`
        : `${line.pct}%  ·  none detected`;
    doc.text(detail, MARGIN + CONTENT_WIDTH, y, { align: "right" });
    y += 8;

    // Progress bar.
    const barH = 6;
    doc.setFillColor(RULE[0], RULE[1], RULE[2]);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, barH, 3, 3, "F");
    doc.setFillColor(band[0], band[1], band[2]);
    const filled = Math.max(0, Math.min(1, line.pct / 100)) * CONTENT_WIDTH;
    if (filled > 0) doc.roundedRect(MARGIN, y, filled, barH, 3, 3, "F");
    y += barH + 16;
  }

  // ---- What went well / what's missing ----
  const termBlock = (group: TermGroup, color: RGB, emptyText: string) => {
    ensure(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(color);
    doc.text(`${group.heading} (${group.terms.length})`, MARGIN, y);
    y += 14;
    paragraph(group.terms.length > 0 ? group.terms.join(", ") : emptyText, {
      color: group.terms.length > 0 ? INK : MUTED,
      gap: 8,
    });
  };

  sectionHeading("What went well");
  for (const g of report.strengths) {
    termBlock(g, BAND_COLOR.strong, "Nothing from the posting was matched here.");
  }

  sectionHeading("What's missing");
  for (const g of report.weaknesses) {
    termBlock(g, BAND_COLOR.weak, "None — fully covered.");
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
    for (let i = 0; i < lines.length; i++) {
      ensure(14);
      doc.text(lines[i], MARGIN + 14, y);
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
      "Generated by CareerLog · estimated fit from keyword & skill coverage",
      MARGIN,
      PAGE.height - 24
    );
    doc.text(`${p} / ${pages}`, PAGE.width - MARGIN, PAGE.height - 24, {
      align: "right",
    });
  }

  return doc;
}
