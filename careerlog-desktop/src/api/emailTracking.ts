import type { EmailClassification } from "../types/emailTracking";
import { apiClient } from "./client";

/**
 * Classify a recruiting email and match it to tracked jobs (deterministic
 * backend heuristics — no AI). Responses are already unwrapped by apiClient.
 */
export function classifyEmail(text: string, subject?: string) {
  return apiClient.post<EmailClassification>("/api/email-tracking/classify", {
    text,
    subject: subject || undefined,
  });
}
