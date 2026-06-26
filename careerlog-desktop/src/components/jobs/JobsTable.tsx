import type { Job } from "../../types/job";
import { StatusBadge } from "./StatusBadge";
import { ColumnSettings } from "./ColumnSettings";
import { useColumnPreferences } from "./useColumnPreferences";
import { ACTIONS_COLUMN_KEY } from "./jobColumns";

interface JobsTableProps {
  jobs: Job[];
  loading: boolean;
  onEdit: (job: Job) => void;
  onDelete: (id: string) => void;
}

export function JobsTable({
  jobs,
  loading,
  onEdit,
  onDelete,
}: JobsTableProps) {
  // Layout preference (column order + visibility) — persisted, distinct from
  // saved searches (FEAT-18). Hooks run before any early return.
  const { prefs, orderedVisible, toggle, move, reset, labelOf } =
    useColumnPreferences();

  if (loading) {
    return (
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500 shadow-sm">
        Loading jobs…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500 shadow-sm">
        No jobs found.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      {/* Column customization (desktop table only). */}
      <div className="hidden items-center justify-end border-b px-4 py-2 md:flex">
        <ColumnSettings
          prefs={prefs}
          labelOf={labelOf}
          toggle={toggle}
          move={move}
          reset={reset}
        />
      </div>

      {/* =======================
         DESKTOP TABLE (SCROLLABLE)

         The table sizes to its visible columns (no fixed min-width), so hiding
         columns makes the grid more compact and showing more lengthens it,
         scrolling horizontally only when needed.
      ======================= */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-auto">
          <thead className="border-b bg-gray-50 text-left text-sm">
            <tr>
              {orderedVisible.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 ${col.headerClassName ?? ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y text-sm">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                {orderedVisible.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-3.5 ${col.cellClassName ?? ""}`}
                  >
                    {col.key === ACTIONS_COLUMN_KEY ? (
                      <>
                        <button
                          onClick={() => onEdit(job)}
                          className="mr-4 text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(job.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      col.render?.(job)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =======================
         MOBILE CARDS
      ======================= */}
      <div className="divide-y md:hidden">
        {jobs.map((job) => (
          <div key={job.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">
                  {job.jobTitle}
                </div>
                <div className="text-sm text-gray-600">
                  {job.company}
                </div>
              </div>
              <StatusBadge
                status={job.status}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">
                  Location
                </span>
                <div>{job.location}</div>
              </div>

              <div>
                <span className="text-gray-500">
                  Type
                </span>
                <div className="capitalize">
                  {job.employmentType.replace(
                    "-",
                    " "
                  )}
                </div>
              </div>

              <div>
                <span className="text-gray-500">
                  Salary
                </span>
                <div className="flex flex-col">
                  <span>
                    $
                    {job.salaryTarget.toLocaleString()}
                  </span>
                  {job.salaryRange && (
                    <span className="text-xs text-gray-500">
                      {job.salaryRange}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-gray-500">
                  Updated
                </span>
                <div>
                  {new Date(
                    job.updatedAt
                  ).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-6">
              <button
                onClick={() =>
                  onEdit(job)
                }
                className="text-sm text-blue-600"
              >
                Edit
              </button>
              <button
                onClick={() =>
                  onDelete(job.id)
                }
                className="text-sm text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
