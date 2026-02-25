/* ============================================================
   Analytics Types (Authoritative)
============================================================ */

/**
 * Job status counts returned by:
 * GET /api/analytics/jobs/status-counts
 *
 * Matches backend JobStatusCounts schema.
 */
export interface JobStatusCounts {
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
  total: number;
}