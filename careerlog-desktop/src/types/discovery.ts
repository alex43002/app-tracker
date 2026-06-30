// Job discovery & aggregation (FEAT-22). Mirrors /api/discovery responses.

export interface DiscoverySourceRef {
  source: string;
  boardToken?: string | null;
  url?: string | null;
}

/** A normalized, aggregated public posting. */
export interface DiscoveredJob {
  id: string;
  source: string;
  sourceId: string;
  boardToken: string;
  company: string;
  title: string;
  location: string | null;
  employmentType: string | null;
  url: string;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: string | null;
  ingestedAt: string;
  updatedAt: string;

  // Derived at ingest (FEAT-22 enrichment).
  experienceLevel: string | null;
  requiresDegree: boolean;
  sponsorshipAvailable: boolean | null;
  clearanceRequired: boolean;
  qualityFlags: string[];
  qualityScore: number;

  // Present when duplicates are collapsed (the default listing mode).
  duplicateCount?: number;
  sources?: DiscoverySourceRef[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface DiscoveredJobPage {
  items: DiscoveredJob[];
  meta: PaginationMeta;
}

/** Filters accepted by the discovery list endpoint. */
export interface DiscoveryFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  collapse?: boolean;
  q?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  source?: string;
  salaryMin?: number;
  experienceLevel?: string;
  requiresDegree?: boolean;
  sponsorshipAvailable?: boolean;
  clearanceRequired?: boolean;
  maxAgeDays?: number;
  minQuality?: number;
  applyPreferences?: boolean;
  preferredOnly?: boolean;
}

/** Per-user company preferences (FEAT-22). */
export interface Preferences {
  preferredCompanies: string[];
  hiddenCompanies: string[];
  hiddenEmploymentTypes: string[];
}

/** Saved discovery search criteria (a subset of the discovery filters). */
export type AlertCriteria = Record<string, string | number | boolean>;

/** A saved discovery search that notifies on new matching postings (FEAT-22). */
export interface JobAlert {
  id: string;
  name: string;
  criteria: AlertCriteria;
  notify: boolean;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  lastMatchCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Result of re-running a saved search (FEAT-22). */
export interface JobAlertCheck {
  newMatches: number;
  total: number;
}

export interface IngestResult {
  source: string;
  company: string;
  fetched: number;
  inserted: number;
  updated: number;
}

/** ATS source + board token extracted from a pasted careers URL (FEAT-23). */
export interface ResolvedBoard {
  source: string;
  boardToken: string;
}

/** An entry in the curated directory of popular public boards (FEAT-23). */
export interface CompanyDirectoryEntry {
  name: string;
  source: string;
  boardToken: string;
}
