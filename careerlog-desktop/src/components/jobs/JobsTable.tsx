import type { Job } from "../../types/job";

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
      {/* =======================
         DESKTOP TABLE (SCROLLABLE)
      ======================= */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-[1000px] w-full">
          <thead className="border-b bg-gray-50 text-left text-sm">
            <tr>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Salary</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y text-sm">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="hover:bg-gray-50"
              >
                <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                  {job.company}
                </td>

                <td className="px-5 py-3.5">
                  <div className="flex flex-col">
                    <span className="whitespace-nowrap">
                      {job.jobTitle}
                    </span>
                    {job.jobId && (
                      <span className="text-xs text-gray-500">
                        {job.jobId}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-5 py-3.5 whitespace-nowrap">
                  {job.location}
                </td>

                <td className="px-5 py-3.5 capitalize whitespace-nowrap">
                  {job.employmentType.replace(
                    "-",
                    " "
                  )}
                </td>

                <td className="px-5 py-3.5 whitespace-nowrap">
                  <StatusBadge
                    status={job.status}
                  />
                </td>

                <td className="px-5 py-3.5 whitespace-nowrap">
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
                </td>

                <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                  {new Date(
                    job.updatedAt
                  ).toLocaleDateString()}
                </td>

                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button
                    onClick={() =>
                      onEdit(job)
                    }
                    className="mr-4 text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      onDelete(job.id)
                    }
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
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

/* ============================================================
   Status Badge
============================================================ */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const color =
    status === "offer"
      ? "bg-green-100 text-green-800"
      : status === "interviewing"
      ? "bg-blue-100 text-blue-800"
      : status === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}
