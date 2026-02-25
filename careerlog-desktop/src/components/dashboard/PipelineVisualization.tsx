import type { JobStatusCounts } from "../../types/analytics";

/* ============================================================
   Pipeline Visualization (Dashboard Funnel)
   - Uses analytics endpoint (no job list aggregation)
   - Includes all pipeline phases
   - Handles loading + empty state
============================================================ */

export function PipelineVisualization({
  stats,
  isLoading,
}: {
  stats: JobStatusCounts | null;
  isLoading?: boolean;
}) {
  /* ============================================================
     Loading Skeleton State
  ============================================================ */
  if (isLoading) {
    return (
      <div className="rounded-md border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-gray-700">
          Application Pipeline
        </h2>

        <div className="mt-3 h-3 w-full overflow-hidden rounded bg-gray-100 animate-pulse" />

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-400">
          <span>Loading pipeline…</span>
        </div>
      </div>
    );
  }

  /* ============================================================
     Defensive Guard
  ============================================================ */
  if (!stats) {
    return null;
  }

  /* ============================================================
     Empty State
  ============================================================ */
  if (stats.total === 0) {
    return (
      <div className="rounded-md border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-gray-700">
          Application Pipeline
        </h2>

        <div className="mt-3 text-sm text-gray-500">
          Your pipeline will appear here once you start tracking applications.
        </div>
      </div>
    );
  }

  const total = stats.total || 1;

  const segments = [
    {
      label: "Applied",
      count: stats.applied,
      color: "bg-gray-400",
    },
    {
      label: "Interviewing",
      count: stats.interviewing,
      color: "bg-yellow-400",
    },
    {
      label: "Offer",
      count: stats.offer,
      color: "bg-green-500",
    },
    {
      label: "Rejected",
      count: stats.rejected,
      color: "bg-red-400",
    },
  ];

  return (
    <div className="rounded-md border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-gray-700">
        Application Pipeline
      </h2>

      {/* ============================================================
          Visual Funnel Bar
      ============================================================ */}
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded bg-gray-100">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{
              width: `${(s.count / total) * 100}%`,
            }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      {/* ============================================================
          Legend / Counts
      ============================================================ */}
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