import type { JobStatusCounts } from "../../types/analytics";

/* ============================================================
   Job Stats Grid (Dashboard KPIs)
   - Uses analytics endpoint
   - Handles loading + empty state cleanly
   - Includes rejected status
============================================================ */

export function JobStatsGrid({
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
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
     Empty State (New User / No Jobs Yet)
  ============================================================ */
  if (stats.total === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-gray-500">
        You haven’t added any jobs yet.  
        Start tracking applications to see your progress here.
      </div>
    );
  }

  /* ============================================================
     Normal KPI Render
  ============================================================ */
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        label="Rejected"
        value={stats.rejected}
        emphasis="muted"
      />
      <Stat
        label="Total Jobs"
        value={stats.total}
        emphasis="muted"
      />
    </div>
  );
}

/* ============================================================
   Stat Card
============================================================ */

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

/* ============================================================
   Skeleton Loader
============================================================ */

function StatSkeleton() {
  return (
    <div className="rounded-md border p-5 shadow-sm animate-pulse">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-2 h-8 w-16 rounded bg-gray-200" />
    </div>
  );
}