import type { Job } from "../../types/job";

export function PipelineVisualization({ jobs }: { jobs: Job[] }) {
  const total = jobs.length || 1;

  const segments = [
    { label: "Applied", count: jobs.filter(j => j.status === "applied").length, color: "bg-gray-400" },
    { label: "Interviewing", count: jobs.filter(j => j.status === "interviewing").length, color: "bg-yellow-400" },
    { label: "Offer", count: jobs.filter(j => j.status === "offer").length, color: "bg-green-500" }
  ];

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 text-sm font-medium text-gray-700">
        Application Pipeline
      </h2>

      <div className="flex h-3 w-full overflow-hidden rounded bg-gray-100">
        {segments.map(s => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-600">
        {segments.map(s => (
          <span key={s.label}>
            {s.label}: {s.count}
          </span>
        ))}
      </div>
    </div>
  );
}
