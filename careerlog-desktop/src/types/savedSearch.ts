/* ============================================================
   Saved Searches (FEAT-11)
============================================================ */

/** Whitelisted job-list filters a saved search may store. */
export interface SavedSearchFilters {
  status?: string;
  employmentType?: string;
  company?: string;
  location?: string;
}

export type SortOrder = "asc" | "desc";

/** A named, reusable job-list query owned by the user. */
export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  sortBy: string;
  sortOrder: SortOrder;
  createdAt: string;
  updatedAt: string;
}

/** Payload to create a saved search. */
export interface CreateSavedSearchPayload {
  name: string;
  filters?: SavedSearchFilters;
  sortBy?: string;
  sortOrder?: SortOrder;
}

/** Partial update payload. */
export type UpdateSavedSearchPayload = Partial<CreateSavedSearchPayload>;
