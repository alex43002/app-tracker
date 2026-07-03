import type { CompanyRef, CompanySnapshot } from "../types/companyResearch";
import { apiClient } from "./client";

/* ============================================================
   Company research snapshots (derived from discovered postings)
   Responses are already unwrapped by apiClient.
============================================================ */

export async function fetchResearchCompanies(q?: string): Promise<CompanyRef[]> {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const res = await apiClient.get<{ companies: CompanyRef[] }>(
    `/api/company-research/companies${qs}`
  );
  return res.companies;
}

export function fetchCompanySnapshot(company: string) {
  return apiClient.get<CompanySnapshot>(
    `/api/company-research/snapshot?company=${encodeURIComponent(company)}`
  );
}
