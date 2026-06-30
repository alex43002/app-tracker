import type {
  AlertCriteria,
  JobAlert,
  JobAlertCheck,
} from "../types/discovery";
import { apiClient } from "./client";

/* ============================================================
   Saved discovery searches + job alerts (FEAT-22)

   A saved search re-runs a set of discovery filters and notifies
   the owner when new matching postings are ingested. Responses
   are already unwrapped by apiClient.
============================================================ */

export async function fetchJobAlerts(): Promise<JobAlert[]> {
  const res = await apiClient.get<{ items: JobAlert[] }>("/api/job-alerts/");
  return res.items;
}

export function createJobAlert(
  name: string,
  criteria: AlertCriteria,
  notify = true
) {
  return apiClient.post<JobAlert>("/api/job-alerts/", { name, criteria, notify });
}

export function updateJobAlert(
  id: string,
  patch: Partial<Pick<JobAlert, "name" | "criteria" | "notify">>
) {
  return apiClient.put<JobAlert>(`/api/job-alerts/${id}`, patch);
}

export function deleteJobAlert(id: string) {
  return apiClient.delete<void>(`/api/job-alerts/${id}`);
}

/** Re-run the saved search now; returns new + total match counts. */
export function checkJobAlert(id: string) {
  return apiClient.post<JobAlertCheck>(`/api/job-alerts/${id}/check`);
}
