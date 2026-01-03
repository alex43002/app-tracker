import type { Alert } from "../types/alert";
import { apiClient, type PaginatedResponse } from "./client";

export function fetchAlerts(page = 1, pageSize = 10) {
  return apiClient.get<PaginatedResponse<Alert>>(
    `/api/alerts/?page=${page}&pageSize=${pageSize}`
  );
}
