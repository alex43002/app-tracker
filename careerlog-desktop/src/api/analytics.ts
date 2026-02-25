import type { JobStatusCounts } from "../types/analytics";
import { apiClient } from "./client";

/* ============================================================
   Read (Analytics)
============================================================ */

/**
 * Fetch job status counts for dashboard KPIs.
 *
 * Endpoint:
 * - GET /api/analytics/jobs/status-counts
 *
 * Notes:
 * - Response is already unwrapped by apiClient
 * - Scoped to current authenticated user
 */
export function fetchJobStatusCounts() {
  return apiClient.get<JobStatusCounts>(
    "/api/analytics/status-counts"
  );
}