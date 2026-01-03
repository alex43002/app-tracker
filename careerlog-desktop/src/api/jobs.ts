import type { Job } from "../types/job";
import { apiClient, type PaginatedResponse } from "./client";

export function fetchJobs(page = 1, pageSize = 10) {
  return apiClient.get<PaginatedResponse<Job>>(
    `/api/jobs/?page=${page}&pageSize=${pageSize}`
  );
}
