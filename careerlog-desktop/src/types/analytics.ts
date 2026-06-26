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

/* ---- Richer analytics (FEAT-7) ---- */

/**
 * Status counts plus headline conversion rates. Each rate is a 0..1 ratio
 * (multiply by 100 for a percentage). Matches backend `Funnel`.
 */
export interface Funnel extends JobStatusCounts {
  responseRate: number;
  interviewRate: number;
  offerRate: number;
}

export interface TimePoint {
  period: string; // "YYYY-MM"
  count: number;
}

export interface ApplicationsOverTime {
  interval: string; // currently always "month"
  points: TimePoint[];
}

/** Days from application to offer. Null when there are no offers yet. */
export interface TimeToOffer {
  offers: number;
  averageDays: number | null;
  medianDays: number | null;
}

export interface CompanyFunnel extends JobStatusCounts {
  company: string;
}

export interface CompanyFunnels {
  companies: CompanyFunnel[];
}

/** Bucket granularity for applications-over-time (FEAT-13). */
export type AnalyticsInterval = "week" | "month" | "quarter";

/**
 * All headline analytics in one payload (CLN-13). Matches backend
 * `AnalyticsSummary` — one round-trip instead of four.
 */
export interface AnalyticsSummary {
  funnel: Funnel;
  applicationsOverTime: ApplicationsOverTime;
  timeToOffer: TimeToOffer;
  byCompany: CompanyFunnels;
}