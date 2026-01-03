import type { Job } from "../../types/job";

export function JobStatsGrid({ jobs }: { jobs: Job[] }) {
  const stats = {
    applied: jobs.filter(j => j.status === "applied").length,
    interviewing: jobs.filter(j => j.status === "interviewing").length,
    offer: jobs.filter(j => j.status === "offer").length,
    total: jobs.length
  };

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Stat label="Applied" value={stats.applied} />
      <Stat label="Interviewing" value={stats.interviewing} />
      <Stat label="Offers" value={stats.offer} />
      <Stat label="Total Jobs" value={stats.total} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-4">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
