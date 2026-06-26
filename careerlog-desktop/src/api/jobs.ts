import type { Job, JobResume } from "../types/job";
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
  notes?: string | null;
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

/**
 * Fetch resume file for a job.
 *
 * Notes:
 * - Uses API_BASE_URL (critical)
 * - Injects Authorization header
 * - Returns a real File
 */
export async function fetchJobResume(
  resumeId: string
): Promise<File | null> {
  const token =
    localStorage.getItem("careerlog_token");

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/resumes/${resumeId}`,
    {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
    }
  );

  // HARD GUARDS (prevents this bug forever)
  if (!response.ok) {
    console.error("Resume fetch failed", response.status);
    return null;
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.startsWith("application/")) {
    console.error(
      "Invalid resume content type",
      contentType
    );
    return null;
  }

  const blob = await response.blob();

  const filename =
    response.headers
      .get("content-disposition")
      ?.match(/filename="(.+)"/)?.[1] ??
    "resume.pdf";

  return new File([blob], filename, {
    type: blob.type,
  });
}


/* ============================================================
   Multiple résumés per job (FEAT-10)
============================================================ */

/** List the résumés attached to a job. */
export async function fetchJobResumes(jobId: string): Promise<JobResume[]> {
  const res = await apiClient.get<{ resumes: JobResume[] }>(
    `/api/jobs/${jobId}/resumes`
  );
  return res.resumes;
}

/** Attach a résumé file to a job; returns the created entry. */
export function uploadJobResume(jobId: string, file: File) {
  const form = new FormData();
  form.append("resume", file);
  return apiClient.post<JobResume>(`/api/jobs/${jobId}/resumes`, form);
}

/** Remove a résumé from a job (also deletes the underlying file). */
export function deleteJobResume(jobId: string, resumeId: string) {
  return apiClient.delete<void>(`/api/jobs/${jobId}/resumes/${resumeId}`);
}

/**
 * Fetch a résumé as a blob object URL suitable for in-app preview (FEAT-10).
 *
 * The bytes are fetched with the bearer token (native preview elements like
 * <iframe>/<embed> can't send Authorization headers, so we can't point them at
 * the API directly). The caller owns the returned URL and must
 * `URL.revokeObjectURL` it when done. Returns null on failure.
 */
export async function fetchResumePreviewUrl(
  resumeId: string
): Promise<string | null> {
  const token = localStorage.getItem("careerlog_token");

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/resumes/${resumeId}?disposition=inline`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );

  if (!response.ok) {
    console.error("Resume preview fetch failed", response.status);
    return null;
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
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
