import type {
  CreateSavedSearchPayload,
  SavedSearch,
  UpdateSavedSearchPayload,
} from "../types/savedSearch";
import { apiClient } from "./client";

/* ============================================================
   Saved Searches (FEAT-11)

   Named, reusable job-list queries (filters + sort). Responses are
   already unwrapped by apiClient.
============================================================ */

/** List the current user's saved searches (oldest first). */
export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const res = await apiClient.get<{ items: SavedSearch[] }>(
    "/api/saved-searches/"
  );
  return res.items;
}

/** Create a new saved search. */
export function createSavedSearch(payload: CreateSavedSearchPayload) {
  return apiClient.post<SavedSearch>("/api/saved-searches/", payload);
}

/** Update an existing saved search. */
export function updateSavedSearch(
  id: string,
  payload: UpdateSavedSearchPayload
) {
  return apiClient.put<SavedSearch>(`/api/saved-searches/${id}`, payload);
}

/** Delete a saved search. */
export function deleteSavedSearch(id: string) {
  return apiClient.delete<void>(`/api/saved-searches/${id}`);
}
