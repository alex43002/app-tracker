import type { Job } from "../../types/job";

export function RecentJobsTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="rounded border">
      <div className="border-b px-4 py-2 font-medium">
        Recent Jobs
      </div>

      <table className="w-full text-sm">
        <tbody>
          {jobs.slice(0, 6).map(job => (
            <tr key={job.id} className="border-b">
              <td className="px-4 py-3 font-medium">{job.company}</td>
              <td className="px-4 py-3">{job.jobTitle}</td>
              <td className="px-4 py-3 capitalize text-gray-600">
                {job.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
