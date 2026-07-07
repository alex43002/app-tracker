import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { fetchSourcePerformance } from "../api/analytics";
import type { SourceFunnel } from "../types/analytics";

/* ============================================================
   Source performance analytics

   Which job boards, recruiters, and referral channels produce the
   best results. Each tracked job is bucketed by the channel it came
   from (derived from its URL), and we show the funnel + conversion
   rates per source so users can double down on what works.
============================================================ */

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function Sources() {
  const [sources, setSources] = useState<SourceFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSourcePerformance()
      .then((res) => setSources(res.sources))
      .catch(() => toast.error("Failed to load source analytics"))
      .finally(() => setLoading(false));
  }, []);

  // Best channel by offer rate, among those with at least 2 applications.
  const best = sources
    .filter((s) => s.total >= 2)
    .reduce<SourceFunnel | null>(
      (acc, s) => (acc == null || s.offerRate > acc.offerRate ? s : acc),
      null,
    );

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Source performance</h1>
          <p className="text-sm text-gray-500">
            Which channels your applications come from and how well each one
            converts. Sources are derived from each job's URL.
          </p>
        </div>

        {loading ? (
          <div className="rounded border p-6 text-sm text-gray-500">
            Loading…
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No tracked jobs yet. Add jobs with their posting URLs and this
            report will show which channels work best.
          </div>
        ) : (
          <>
            {best && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                Best converting channel:{" "}
                <span className="font-semibold">{best.source}</span> —{" "}
                {pct(best.offerRate)} offer rate across {best.total}{" "}
                applications.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Apps</th>
                    <th className="px-4 py-3 font-medium">Interviewing</th>
                    <th className="px-4 py-3 font-medium">Offers</th>
                    <th className="px-4 py-3 font-medium">Response</th>
                    <th className="px-4 py-3 font-medium">Interview</th>
                    <th className="px-4 py-3 font-medium">Offer rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.source} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {s.source}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{s.total}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {s.interviewing}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{s.offer}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {pct(s.responseRate)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {pct(s.interviewRate)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {pct(s.offerRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">
              Rates are share of that source's applications. Add posting URLs to
              your jobs for the most accurate attribution.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
