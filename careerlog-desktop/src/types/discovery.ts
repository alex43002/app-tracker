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
  maxAgeDays?: number;
  minQuality?: number;
}

export interface IngestResult {
  source: string;
  company: string;
  fetched: number;
  inserted: number;
  updated: number;
}
