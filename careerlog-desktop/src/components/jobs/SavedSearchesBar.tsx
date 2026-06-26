import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import {
  createSavedSearch,
  deleteSavedSearch,
  fetchSavedSearches,
} from "../../api/savedSearches";
import { ApiError } from "../../api/client";
import type {
  SavedSearch,
  SavedSearchFilters,
  SortOrder,
} from "../../types/savedSearch";

interface SavedSearchesBarProps {
  /** The current server-side filters/sort, used when saving a new search. */
  filters: SavedSearchFilters;
  sortBy: string;
  sortOrder: SortOrder;
  onApply: (search: SavedSearch) => void;
}

/**
 * Saved searches (FEAT-11): save the current filter/sort as a named view,
 * re-apply one with a click, or delete it. Built on the hardened, whitelisted
 * filter mechanism, so a saved search is always safe to replay.
 */
export function SavedSearchesBar({
  filters,
  sortBy,
  sortOrder,
  onApply,
}: SavedSearchesBarProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    fetchSavedSearches()
      .then(setSearches)
      .catch(() => {
        /* Non-fatal: saved searches are an enhancement, not core. */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await createSavedSearch({
        name: trimmed,
        filters,
        sortBy,
        sortOrder,
      });
      setSearches((prev) => [...prev, created]);
      setName("");
      setNaming(false);
      toast.success("Search saved");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.displayMessage : "Failed to save search"
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSavedSearch(id);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Failed to delete search");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Saved searches
      </span>

      {searches.length === 0 && !naming && (
        <span className="text-sm text-gray-400">None yet</span>
      )}

      {searches.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-3 py-1 text-sm"
        >
          <button
            type="button"
            onClick={() => onApply(s)}
            className="font-medium text-gray-700 hover:text-black"
          >
            {s.name}
          </button>
          <button
            type="button"
            aria-label={`Delete saved search ${s.name}`}
            onClick={() => handleDelete(s.id)}
            className="text-gray-400 hover:text-red-600"
          >
            ×
          </button>
        </span>
      ))}

      {naming ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setNaming(false);
                setName("");
              }
            }}
            placeholder="Name this search"
            className="rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-black px-2 py-1 text-sm text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
            className="rounded-md border px-2 py-1 text-sm"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="rounded-md border border-dashed px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          + Save current
        </button>
      )}
    </div>
  );
}
