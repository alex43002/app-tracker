// Résumé ↔ job matching (FEAT-21). Mirrors the backend /api/match responses.

/** The skills + keywords extracted from a block of text. */
export interface ExtractedTerms {
  skills: string[];
  keywords: string[];
}

/** How well the résumé covers each part of the posting. `null` = the posting
 * had no such section (or no recognized concepts) — never a fake 100%. */
export interface CoverageInfo {
  required: number | null;
  responsibility: number | null;
  preferred: number | null;
  concept: number | null; // curated-skill signal; null = N/A
  keyword: number;
}

export type MatchStatus = "strong" | "partial" | "foundational" | "missing";
export type MatchBucket = "required" | "responsibility" | "preferred";

/** One evaluated job term with the résumé evidence that earned its status. */
export interface TermMatch {
  term: string;
  status: MatchStatus;
  bucket: MatchBucket;
  isConcept: boolean;
  evidence: string[];
  category?: string | null;
}

/** Result of scoring a résumé against a job description. */
export interface MatchScore {
  score: number; // 0..100
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  skillSignalAvailable: boolean;
  roleFamilies: string[];
  coverage: CoverageInfo;
  strengths: TermMatch[]; // strong / partial / foundational, best first
  gaps: TermMatch[]; // missing, most important first
  resume: ExtractedTerms;
  job: ExtractedTerms;
}

/** Result of scraping a job-posting URL. */
export interface ScrapeResult {
  title: string;
  textLength: number;
  skills: string[];
  keywords: string[];
}

/**
 * Result of extracting an ad-hoc résumé upload. `text` is the extracted plain
 * text, replayed as `resumeText` when scoring — the file itself isn't stored.
 */
export interface ResumeExtractResult {
  filename: string;
  textLength: number;
  skills: string[];
  keywords: string[];
  text: string;
}

/** Request payload for scoring — one résumé source and one job source. */
export interface ScorePayload {
  resumeId?: string;
  resumeText?: string;
  jobUrl?: string;
  jobDescription?: string;
}
