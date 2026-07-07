import type { DiscoveredJob } from "../../types/discovery";

/* ============================================================
   Discovered job card (FEAT-22)

   Shows a normalized posting with its eligibility/quality
   signals, freshness, source(s), and (optionally) résumé fit.
============================================================ */

const QUALITY_FLAG_LABELS: Record<string, string> = {
  no_salary: "No salary listed",
  thin_description: "Sparse description",
  no_location: "No location",
  underpaid: "Below-market pay",
  spammy_title: "Spammy title",
};

function formatSalary(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null && min !== max)
    return `${fmt(min)}–${fmt(max)}`;
  return fmt((min ?? max) as number);
}

/** Whole days since `iso`, or null if unknown. */
function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

function freshnessLabel(iso: string | null): { text: string; stale: boolean } {
  const days = ageDays(iso);
  if (days == null) return { text: "Date unknown", stale: true };
  if (days <= 0) return { text: "Today", stale: false };
  if (days === 1) return { text: "Yesterday", stale: false };
  if (days < 30) return { text: `${days}d ago`, stale: false };
  return { text: `${days}d ago`, stale: true };
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "good" | "info";
}) {
  const styles = {
    neutral: "bg-gray-100 text-gray-700",
    warn: "bg-amber-100 text-amber-800",
    good: "bg-green-100 text-green-800",
    info: "bg-blue-100 text-blue-800",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

export function JobCard({
  job,
  fit,
  onHideCompany,
}: {
  job: DiscoveredJob;
  fit?: number | null;
  onHideCompany?: (company: string) => void;
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const fresh = freshnessLabel(job.postedAt);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            {job.title}
          </a>
          <p className="text-sm text-gray-700">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
            {onHideCompany && (
              <button
                onClick={() => onHideCompany(job.company)}
                className="ml-2 text-xs text-gray-400 hover:text-red-600 hover:underline"
                title={`Hide ${job.company} from discovery`}
              >
                hide
              </button>
            )}
          </p>
        </div>
        {typeof fit === "number" && (
          <div className="shrink-0 text-right">
            <div
              className={`text-lg font-bold ${
                fit >= 75
                  ? "text-green-700"
                  : fit >= 50
                    ? "text-amber-700"
                    : "text-red-700"
              }`}
            >
              {fit}%
            </div>
            <div className="text-[10px] uppercase text-gray-400">fit</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {salary && <Pill tone="good">{salary}</Pill>}
        {job.employmentType && <Pill>{job.employmentType}</Pill>}
        {job.workArrangement && (
          <Pill tone={job.workArrangement === "remote" ? "good" : "neutral"}>
            {job.workArrangement}
          </Pill>
        )}
        {job.experienceLevel && <Pill tone="info">{job.experienceLevel}</Pill>}
        {job.requiresDegree && <Pill>degree</Pill>}
        {job.sponsorshipAvailable === true && (
          <Pill tone="good">sponsors visa</Pill>
        )}
        {job.sponsorshipAvailable === false && (
          <Pill tone="warn">no sponsorship</Pill>
        )}
        {job.clearanceRequired && <Pill tone="warn">clearance</Pill>}
        <Pill tone={fresh.stale ? "warn" : "neutral"}>{fresh.text}</Pill>
        {job.duplicateCount && job.duplicateCount > 1 && (
          <Pill tone="info">{job.duplicateCount} sources</Pill>
        )}
        {!job.duplicateCount && <Pill>{job.source}</Pill>}
        {job.qualityScore < 60 && (
          <Pill tone="warn">low quality ({job.qualityScore})</Pill>
        )}
      </div>

      {job.qualityFlags.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          ⚠{" "}
          {job.qualityFlags.map((f) => QUALITY_FLAG_LABELS[f] ?? f).join(" · ")}
        </p>
      )}
    </div>
  );
}
