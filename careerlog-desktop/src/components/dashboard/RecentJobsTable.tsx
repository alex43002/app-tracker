import type { Job } from "../../types/job";

export function RecentJobsTable({ jobs }: { jobs: Job[] }) {
  const recent = jobs.slice(0, 6);

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <div className="border-b px-5 py-3 font-medium">
        Recent Jobs
      </div>

      {recent.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-500">
          No recent jobs.
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {recent.map((job) => (
              <tr
                key={job.id}
                className="hover:bg-gray-50"
              >
                <td className="px-5 py-3 font-medium whitespace-nowrap">
                  {job.company}
                </td>

                <td className="px-5 py-3">
                  {job.jobTitle}
                </td>

                <td className="px-5 py-3 capitalize text-gray-600 whitespace-nowrap">
                  {job.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
