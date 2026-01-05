import { useEffect, useState } from "react";

export type JobFilters = {
  search?: string;
  status?: string;
  employmentType?: string;
};

interface JobsToolbarProps {
  filters: JobFilters;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onChange: (args: {
    filters: JobFilters;
    sortBy: string;
    sortOrder: "asc" | "desc";
  }) => void;
}

export function JobsToolbar({
  filters,
  sortBy,
  sortOrder,
  onChange,
}: JobsToolbarProps) {
  const [localFilters, setLocalFilters] =
    useState<JobFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  function updateFilters(partial: Partial<JobFilters>) {
    const next = { ...localFilters, ...partial };
    setLocalFilters(next);
    onChange({ filters: next, sortBy, sortOrder });
  }

  function updateSort(
    field: string,
    order: "asc" | "desc"
  ) {
    onChange({ filters: localFilters, sortBy: field, sortOrder: order });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-white p-4 md:flex-row md:items-end md:justify-between">
      {/* =======================
         Filters
      ======================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Search */}
        <input
          placeholder="Search company or title"
          value={localFilters.search ?? ""}
          onChange={(e) =>
            updateFilters({ search: e.target.value || undefined })
          }
          className="rounded-md border px-3 py-2 text-sm"
        />

        {/* Status */}
        <select
          value={localFilters.status ?? ""}
          onChange={(e) =>
            updateFilters({
              status: e.target.value || undefined,
            })
          }
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="applied">Applied</option>
          <option value="interviewing">Interviewing</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Employment Type */}
        <select
          value={localFilters.employmentType ?? ""}
          onChange={(e) =>
            updateFilters({
              employmentType: e.target.value || undefined,
            })
          }
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
        </select>
      </div>

      {/* =======================
         Sorting
      ======================= */}
      <div className="flex items-center gap-2">
        <select
          value={sortBy}
          onChange={(e) =>
            updateSort(e.target.value, sortOrder)
          }
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="createdAt">Created date</option>
          <option value="updatedAt">Last updated</option>
          <option value="company">Company</option>
          <option value="jobTitle">Job title</option>
          <option value="salaryTarget">Salary target</option>
        </select>

        <button
          onClick={() =>
            updateSort(
              sortBy,
              sortOrder === "asc" ? "desc" : "asc"
            )
          }
          className="rounded-md border px-3 py-2 text-sm"
        >
          {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>
    </div>
  );
}
