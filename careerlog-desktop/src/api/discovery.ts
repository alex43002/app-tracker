import type {
  DiscoveredJobPage,
  DiscoveryFilters,
  IngestResult,
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
    "/api/discovery/sources"
  );
  return res.sources;
}

/** Fetch a company's public board into the shared discovery store. */
export function ingestBoard(
  source: string,
  boardToken: string,
  companyName?: string
) {
  return apiClient.post<IngestResult>("/api/discovery/ingest", {
    source,
    boardToken,
    companyName,
  });
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
    `/api/discovery/jobs${qs ? `?${qs}` : ""}`
  );
}
