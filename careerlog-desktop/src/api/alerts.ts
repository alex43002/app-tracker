import type {
  Alert,
  CreateAlertPayload,
  UpdateAlertPayload,
} from "../types/alert";
import { apiClient, type PaginatedResponse } from "./client";

/* ============================================================
   Alerts (FEAT-20)

   CRUD over the backend alerts API. The server's background scheduler
   (alerts/runner.py) delivers due alerts; these endpoints manage the
   configuration records. Responses are already unwrapped by apiClient.
============================================================ */

/** List the current user's alerts (soonest first by default). */
export function fetchAlerts(
  page = 1,
  pageSize = 25,
  sortBy = "scheduledAlert",
  sortOrder: "asc" | "desc" = "asc"
) {
  return apiClient.get<PaginatedResponse<Alert>>(
    `/api/alerts/?page=${page}&pageSize=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`
  );
}

/** Create a new alert. */
export function createAlert(payload: CreateAlertPayload) {
  return apiClient.post<{ id: string; createdAt: string; updatedAt: string }>(
    "/api/alerts/",
    payload
  );
}

/** Update an existing alert. */
export function updateAlert(id: string, payload: UpdateAlertPayload) {
  return apiClient.put<{ updatedAt: string }>(`/api/alerts/${id}`, payload);
}

/** Delete an alert. */
export function deleteAlert(id: string) {
  return apiClient.delete<void>(`/api/alerts/${id}`);
}
