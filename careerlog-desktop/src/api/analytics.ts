import type {
  AnalyticsInterval,
  AnalyticsSummary,
  ApplicationsOverTime,
  CompanyFunnels,
  Funnel,
  JobStatusCounts,
  SourcePerformance,
  TimeToOffer,
} from "../types/analytics";
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
  return apiClient.get<JobStatusCounts>("/api/analytics/status-counts");
}

/* ============================================================
   Richer analytics (FEAT-7)
============================================================ */

/** Status counts plus conversion rates (response / interview / offer). */
export function fetchFunnel() {
  return apiClient.get<Funnel>("/api/analytics/funnel");
}

/** Applications grouped by period (week/month/quarter), ascending. */
export function fetchApplicationsOverTime(interval?: AnalyticsInterval) {
  const query = interval ? `?interval=${interval}` : "";
  return apiClient.get<ApplicationsOverTime>(
    `/api/analytics/applications-over-time${query}`,
  );
}

/** Average / median days from application to offer. */
export function fetchTimeToOffer() {
  return apiClient.get<TimeToOffer>("/api/analytics/time-to-offer");
}

/** Per-company status breakdown, busiest companies first. */
export function fetchCompanyFunnels() {
  return apiClient.get<CompanyFunnels>("/api/analytics/by-company");
}

/** Per-source funnel + conversion rates (which channels produce results). */
export function fetchSourcePerformance() {
  return apiClient.get<SourcePerformance>("/api/analytics/source-performance");
}

/* ============================================================
   Combined summary (CLN-13)
============================================================ */

/** All headline analytics in one round-trip. */
export function fetchAnalyticsSummary(interval?: AnalyticsInterval) {
  const query = interval ? `?interval=${interval}` : "";
  return apiClient.get<AnalyticsSummary>(`/api/analytics/summary${query}`);
}
