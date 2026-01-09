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
    filters: Record<string, unknown>;
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
  const [searchInput, setSearchInput] = useState(
    filters.search ?? ""
  );
  const [status, setStatus] = useState(filters.status);
  const [employmentType, setEmploymentType] =
    useState(filters.employmentType);

  /* ============================================================
     Debounce search
  ============================================================ */

  useEffect(() => {
    const timeout = setTimeout(() => {
      const mongoFilters: Record<string, unknown> =
        {};

      if (searchInput) {
        mongoFilters.$or = [
          {
            company: {
              $regex: searchInput,
              $options: "i",
            },
          },
          {
            jobTitle: {
              $regex: searchInput,
              $options: "i",
            },
          },
        ];
      }

      if (status) mongoFilters.status = status;
      if (employmentType)
        mongoFilters.employmentType =
          employmentType;

      onChange({
        filters: mongoFilters,
        sortBy,
        sortOrder,
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    searchInput,
    status,
    employmentType,
    sortBy,
    sortOrder,
  ]);

  /* ============================================================
     UI
  ============================================================ */

  return (
    <div className="rounded-md border bg-white p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        {/* =======================
            Filters
        ======================= */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            placeholder="Search company or title"
            value={searchInput}
            onChange={(e) =>
              setSearchInput(e.target.value)
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={status ?? ""}
            onChange={(e) =>
              setStatus(
                e.target.value || undefined
              )
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">
              All statuses
            </option>
            <option value="applied">
              Applied
            </option>
            <option value="interviewing">
              Interviewing
            </option>
            <option value="offer">
              Offer
            </option>
            <option value="rejected">
              Rejected
            </option>
          </select>

          <select
            value={employmentType ?? ""}
            onChange={(e) =>
              setEmploymentType(
                e.target.value || undefined
              )
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">
              All types
            </option>
            <option value="full-time">
              Full-time
            </option>
            <option value="part-time">
              Part-time
            </option>
            <option value="contract">
              Contract
            </option>
            <option value="internship">
              Internship
            </option>
          </select>
        </div>

        {/* =======================
            Sorting
        ======================= */}
        <div className="flex items-center gap-2 md:border-l md:pl-6">
          <select
            value={sortBy}
            onChange={(e) =>
              onChange({
                filters: {},
                sortBy: e.target.value,
                sortOrder,
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="createdAt">
              Created
            </option>
            <option value="updatedAt">
              Updated
            </option>
            <option value="company">
              Company
            </option>
            <option value="jobTitle">
              Title
            </option>
            <option value="salaryTarget">
              Salary
            </option>
          </select>

          <button
            onClick={() =>
              onChange({
                filters: {},
                sortBy,
                sortOrder:
                  sortOrder === "asc"
                    ? "desc"
                    : "asc",
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
