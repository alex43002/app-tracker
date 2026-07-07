import type { PrepResult } from "../types/interviewPrep";
import { apiClient } from "./client";

/**
 * Turn a job description into role-specific prep notes, topics, and practice
 * questions (deterministic backend generator — no AI).
 */
export function generateInterviewPrep(
  jobDescription: string,
  jobTitle?: string,
) {
  return apiClient.post<PrepResult>("/api/interview-prep/generate", {
    jobDescription,
    jobTitle: jobTitle || undefined,
  });
}
