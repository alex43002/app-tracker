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
    <div className="rounded-md border bg-white">
      {/* Desktop */}
      <table className="hidden w-full md:table">
        <thead className="border-b bg-gray-50 text-left text-sm">
          <tr>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b last:border-0">
              <td className="px-4 py-3">{job.company}</td>
              <td className="px-4 py-3">{job.jobTitle}</td>
              <td className="px-4 py-3 capitalize">{job.status}</td>
              <td className="px-4 py-3">{job.location}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(job)}
                  className="mr-2 text-sm text-blue-600 hover:underline"
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

      {/* Mobile */}
      <div className="divide-y md:hidden">
        {jobs.map((job) => (
          <div key={job.id} className="p-4">
            <div className="font-medium">{job.jobTitle}</div>
            <div className="text-sm text-gray-600">{job.company}</div>
            <div className="mt-1 text-sm capitalize">{job.status}</div>

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
