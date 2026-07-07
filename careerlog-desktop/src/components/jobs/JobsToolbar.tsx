import { useEffect, useState } from "react";

export type JobFilters = {
  search?: string;
  status?: string;
  employmentType?: string;
  company?: string;
  location?: string;
};

/** What the toolbar emits: whitelisted server filters + a client-side search. */
export interface JobsQuery {
  filters: Record<string, unknown>;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface JobsToolbarProps {
  filters: JobFilters;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onChange: (query: JobsQuery) => void;
}

export function JobsToolbar({
  filters,
  sortBy,
  sortOrder,
  onChange,
}: JobsToolbarProps) {
  // Initialized from props on mount. When the parent applies a saved search it
  // remounts this toolbar (via a changing `key`), so there's no effect syncing
  // state back to props (which would trigger cascading renders).
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [status, setStatus] = useState(filters.status);
  const [employmentType, setEmploymentType] = useState(filters.employmentType);
  const [company, setCompany] = useState(filters.company ?? "");
  const [location, setLocation] = useState(filters.location ?? "");

  /* ============================================================
     Debounce → emit whitelisted server filters + client-side search.
     Note: only fields the backend whitelists (status, employmentType,
     company, location) go into `filters`; free-text search is applied
     client-side so we never send rejected Mongo operators (SEC-1).
     company/location are matched server-side as case-insensitive
     substrings (FEAT-19).
  ============================================================ */

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange({
        filters: serverFiltersFrom(status, employmentType, company, location),
        search: searchInput.trim(),
        sortBy,
        sortOrder,
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    searchInput,
    status,
    employmentType,
    company,
    location,
    sortBy,
    sortOrder,
    onChange,
  ]);

  /* ============================================================
     UI
  ============================================================ */

  return (
    <div className="rounded-md border bg-white p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            placeholder="Search company or title"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={status ?? ""}
            onChange={(e) => setStatus(e.target.value || undefined)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="applied">Applied</option>
            <option value="interviewing">Interviewing</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={employmentType ?? ""}
            onChange={(e) => setEmploymentType(e.target.value || undefined)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>

          <input
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 md:border-l md:pl-6">
          <select
            value={sortBy}
            onChange={(e) =>
              onChange({
                filters: serverFiltersFrom(
                  status,
                  employmentType,
                  company,
                  location,
                ),
                search: searchInput.trim(),
                sortBy: e.target.value,
                sortOrder,
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="company">Company</option>
            <option value="jobTitle">Title</option>
            <option value="salaryTarget">Salary</option>
          </select>

          <button
            onClick={() =>
              onChange({
                filters: serverFiltersFrom(
                  status,
                  employmentType,
                  company,
                  location,
                ),
                search: searchInput.trim(),
                sortBy,
                sortOrder: sortOrder === "asc" ? "desc" : "asc",
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>
    </div>
  );
}

function serverFiltersFrom(
  status?: string,
  employmentType?: string,
  company?: string,
  location?: string,
): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (status) f.status = status;
  if (employmentType) f.employmentType = employmentType;
  if (company && company.trim()) f.company = company.trim();
  if (location && location.trim()) f.location = location.trim();
  return f;
}
