import type {
  CompanyDirectoryEntry,
  DiscoveredJobPage,
  DiscoveryFilters,
  IngestResult,
  LocationFacets,
  ResolvedBoard,
} from "../types/discovery";
import { apiClient } from "./client";

/* ============================================================
   Job discovery & aggregation (FEAT-22)

   Aggregated public postings from supported ATS systems.
   Responses are already unwrapped by apiClient.
============================================================ */

/** The ATS sources discovery can ingest from. */
export async function fetchDiscoverySources(): Promise<string[]> {
  const res = await apiClient.get<{ sources: string[] }>(
    "/api/discovery/sources",
  );
  return res.sources;
}

/** Fetch a company's public board into the shared discovery store. */
export function ingestBoard(
  source: string,
  boardToken: string,
  companyName?: string,
) {
  return apiClient.post<IngestResult>("/api/discovery/ingest", {
    source,
    boardToken,
    companyName,
  });
}

/** Extract the ATS source + board token from a pasted careers URL (FEAT-23). */
export function resolveBoardToken(url: string) {
  return apiClient.post<ResolvedBoard>("/api/discovery/resolve", { url });
}

/** Search the curated directory of popular public boards (FEAT-23). */
export async function fetchCompanyDirectory(
  q?: string,
): Promise<CompanyDirectoryEntry[]> {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const res = await apiClient.get<{ companies: CompanyDirectoryEntry[] }>(
    `/api/discovery/companies${qs}`,
  );
  return res.companies;
}

/** Distinct locations present in postings, for the guided filter (FEAT-30). */
export async function fetchLocationFacets(
  q?: string,
  limit = 50,
): Promise<LocationFacets> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q && q.trim()) params.append("q", q.trim());
  return apiClient.get<LocationFacets>(
    `/api/discovery/locations?${params.toString()}`,
  );
}

/** Search/filter the aggregated postings. */
export function fetchDiscoveredJobs(filters: DiscoveryFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return apiClient.get<DiscoveredJobPage>(
    `/api/discovery/jobs${qs ? `?${qs}` : ""}`,
  );
}
