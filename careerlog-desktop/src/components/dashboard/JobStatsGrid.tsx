import type { Job } from "../../types/job";

export function JobStatsGrid({ jobs }: { jobs: Job[] }) {
  const stats = {
    applied: jobs.filter((j) => j.status === "applied").length,
    interviewing: jobs.filter((j) => j.status === "interviewing").length,
    offer: jobs.filter((j) => j.status === "offer").length,
    total: jobs.length,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Applied"
        value={stats.applied}
        emphasis="default"
      />
      <Stat
        label="Interviewing"
        value={stats.interviewing}
        emphasis="info"
      />
      <Stat
        label="Offers"
        value={stats.offer}
        emphasis="success"
      />
      <Stat
        label="Total Jobs"
        value={stats.total}
        emphasis="muted"
      />
    </div>
  );
}

type StatEmphasis = "default" | "info" | "success" | "muted";

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis: StatEmphasis;
}) {
  const emphasisStyles: Record<StatEmphasis, string> = {
    default: "bg-white",
    info: "bg-blue-50",
    success: "bg-green-50",
    muted: "bg-gray-50",
  };

  return (
    <div
      className={`rounded-md border p-5 shadow-sm ${emphasisStyles[emphasis]}`}
    >
      <div className="text-sm text-gray-600">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold">
        {value}
      </div>
    </div>
  );
}
