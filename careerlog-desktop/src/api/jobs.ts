import type { Job } from "../types/job";
import { apiClient, type PaginatedResponse } from "./client";

/* ============================================================
   Payload Types (Authoritative)
============================================================ */

/**
 * Payload required to CREATE a job.
 * Must satisfy backend create_job expectations.
 */
export type CreateJobPayload = {
  jobId?: string | null;
  url: string;
  jobTitle: string;
  company: string;
  salaryTarget: number;
  salaryRange?: string | null;
  status: string;
  resume: File | null;
  location: string;
  employmentType: string;
};

/**
 * Payload allowed to UPDATE a job.
 * Backend ignores undefined fields and rejects empty payloads.
 */
export type UpdateJobPayload = Partial<
  Omit<Job, "id" | "userId" | "createdAt" | "updatedAt" | "resume">
> & {
  resume?: File | null;
};


/* ============================================================
   Read (List)
============================================================ */

/**
 * Fetch paginated jobs for the current user.
 *
 * Notes:
 * - Filters MUST be JSON-stringified
 * - Response is already unwrapped by apiClient
 */
export function fetchJobs(
  page = 1,
  pageSize = 25,
  sortBy = "createdAt",
  sortOrder: "asc" | "desc" = "asc",
  filters?: Record<string, unknown>
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortOrder,
  });

  if (filters) {
    params.append("filters", JSON.stringify(filters));
  }

  return apiClient.get<PaginatedResponse<Job>>(
    `/api/jobs?${params.toString()}`
  );
}

/* ============================================================
   Create
============================================================ */

/**
 * Create a new job.
 *
 * Backend returns ONLY:
 * - id
 * - createdAt
 * - updatedAt
 */
export function createJob(payload: CreateJobPayload) {
  const body = buildUpdatePayload(payload);

  return apiClient.post<{
    id: string;
    createdAt: string;
    updatedAt: string;
  }>("/api/jobs", body);
}

/* ============================================================
   Update
============================================================ */

/**
 * Update an existing job.
 *
 * Backend returns ONLY:
 * - updatedAt
 *
 * Frontend must merge locally.
 */
export function updateJob(id: string, payload: UpdateJobPayload) {
  const body = buildUpdatePayload(payload);

  return apiClient.put<{ updatedAt: string }>(
    `/api/jobs/${id}`,
    body
  );
}

function buildUpdatePayload(payload: UpdateJobPayload) {
  if (payload.resume instanceof File) {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (value instanceof File) {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    });

    return formData;
  }

  // No file → safe JSON
  return payload;
}


/* ============================================================
   Delete
============================================================ */

/**
 * Delete a job.
 *
 * Backend returns no data payload.
 */
export function deleteJob(id: string) {
  return apiClient.delete<void>(`/api/jobs/${id}`);
}
