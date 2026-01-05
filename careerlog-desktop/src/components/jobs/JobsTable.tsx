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
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500">
        Loading jobs…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-md border bg-white p-6 text-sm text-gray-500">
        No jobs found.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white overflow-hidden">
      {/* =======================
         DESKTOP TABLE
      ======================= */}
      <table className="hidden w-full md:table">
        <thead className="border-b bg-gray-50 text-left text-sm">
          <tr>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Salary</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y text-sm">
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="px-4 py-3 font-medium">
                {job.company}
              </td>

              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span>{job.jobTitle}</span>
                  {job.jobId && (
                    <span className="text-xs text-gray-500">
                      {job.jobId}
                    </span>
                  )}
                </div>
              </td>

              <td className="px-4 py-3">{job.location}</td>

              <td className="px-4 py-3 capitalize">
                {job.employmentType.replace("-", " ")}
              </td>

              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
              </td>

              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span>
                    ${job.salaryTarget.toLocaleString()}
                  </span>
                  {job.salaryRange && (
                    <span className="text-xs text-gray-500">
                      {job.salaryRange}
                    </span>
                  )}
                </div>
              </td>

              <td className="px-4 py-3 text-gray-500">
                {new Date(job.updatedAt).toLocaleDateString()}
              </td>

              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(job)}
                  className="mr-3 text-sm text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(job.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* =======================
         MOBILE CARDS
      ======================= */}
      <div className="divide-y md:hidden">
        {jobs.map((job) => (
          <div key={job.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">
                  {job.jobTitle}
                </div>
                <div className="text-sm text-gray-600">
                  {job.company}
                </div>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Location</span>
                <div>{job.location}</div>
              </div>

              <div>
                <span className="text-gray-500">Type</span>
                <div className="capitalize">
                  {job.employmentType.replace("-", " ")}
                </div>
              </div>

              <div>
                <span className="text-gray-500">Salary</span>
                <div className="flex flex-col">
                  <span>
                    ${job.salaryTarget.toLocaleString()}
                  </span>
                  {job.salaryRange && (
                    <span className="text-xs text-gray-500">
                      {job.salaryRange}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-gray-500">Updated</span>
                <div>
                  {new Date(job.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-4">
              <button
                onClick={() => onEdit(job)}
                className="text-sm text-blue-600"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(job.id)}
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

function StatusBadge({ status }: { status: string }) {
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
