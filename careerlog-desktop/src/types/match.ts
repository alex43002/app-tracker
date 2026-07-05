// Résumé ↔ job matching (FEAT-21). Mirrors the backend /api/match responses.

/** The skills + keywords extracted from a block of text. */
export interface ExtractedTerms {
  skills: string[];
  keywords: string[];
}

/** Per-signal coverage and the matched/missing term lists behind a score. */
export interface ScoreBreakdown {
  skillCoverage: number; // 0..1
  keywordCoverage: number; // 0..1
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
}

/** Result of scoring a résumé against a job description. */
export interface MatchScore {
  score: number; // 0..100
  breakdown: ScoreBreakdown;
  // Ordered gap list (missing skills first) for gap analysis.
  gaps: string[];
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
