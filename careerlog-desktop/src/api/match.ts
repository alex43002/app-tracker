import type {
  MatchScore,
  ResumeExtractResult,
  ScorePayload,
  ScrapeResult,
} from "../types/match";
import { apiClient } from "./client";

/* ============================================================
   Résumé ↔ Job matching (FEAT-21)

   Extracts skills/keywords and scores a résumé against a job
   description so a seeker can see their fit before applying.
   Responses are already unwrapped by apiClient.
============================================================ */

/** Scrape a job-posting URL into its title + extracted skills/keywords. */
export function scrapeJob(url: string) {
  return apiClient.post<ScrapeResult>("/api/match/scrape", { url });
}

/**
 * Extract text from an ad-hoc résumé file (PDF/DOCX/TXT) without saving it.
 * The returned `text` is replayed as `resumeText` when scoring.
 */
export function extractResume(file: File) {
  const form = new FormData();
  form.append("resume", file);
  return apiClient.post<ResumeExtractResult>("/api/match/extract-resume", form);
}

/**
 * Score a résumé against a job description. Provide one résumé source
 * (`resumeId` or `resumeText`) and one job source (`jobUrl` or
 * `jobDescription`); the backend validates the combination.
 */
export function scoreMatch(payload: ScorePayload) {
  return apiClient.post<MatchScore>("/api/match/score", payload);
}
