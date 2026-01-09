import type { Job } from "../../types/job";

export function PipelineVisualization({ jobs }: { jobs: Job[] }) {
  const total = jobs.length || 1;

  const segments = [
    {
      label: "Applied",
      count: jobs.filter((j) => j.status === "applied").length,
      color: "bg-gray-400",
    },
    {
      label: "Interviewing",
      count: jobs.filter((j) => j.status === "interviewing").length,
      color: "bg-yellow-400",
    },
    {
      label: "Offer",
      count: jobs.filter((j) => j.status === "offer").length,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="rounded-md border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-700">
        Application Pipeline
      </h2>

      <div className="mt-3 flex h-3 w-full overflow-hidden rounded bg-gray-100">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{
              width: `${(s.count / total) * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
        {segments.map((s) => (
          <span key={s.label}>
            {s.label}:{" "}
            <span className="font-medium text-gray-800">
              {s.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
