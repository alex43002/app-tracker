import type { Preferences } from "../types/discovery";
import { apiClient } from "./client";

/* ============================================================
   User company preferences (FEAT-22)

   Preferred/hidden companies and hidden job types, applied to
   discovery when the caller opts in. Already unwrapped by apiClient.
============================================================ */

export function fetchPreferences() {
  return apiClient.get<Preferences>("/api/preferences/");
}

export function updatePreferences(patch: Partial<Preferences>) {
  return apiClient.put<Preferences>("/api/preferences/", patch);
}
