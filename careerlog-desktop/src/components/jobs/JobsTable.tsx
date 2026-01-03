import type { Job } from "../../types/job";

interface JobsTableProps {
  jobs: Job[];
}

export function JobsTable({ jobs }: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="p-6 text-sm text-gray-500">
        No jobs yet.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="px-4 py-2 font-medium">Company</th>
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Date</th>
        </tr>
      </thead>

      <tbody>
        {jobs.map((job) => (
          <tr
            key={job.id}
            className="border-b last:border-b-0 hover:bg-gray-50"
          >
            <td className="px-4 py-2">
              {job.company}
            </td>

            <td className="px-4 py-2">
              {job.jobTitle}
            </td>

            <td className="px-4 py-2 capitalize">
              {job.status}
            </td>

            <td className="px-4 py-2 text-gray-500">
              {new Date(job.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
