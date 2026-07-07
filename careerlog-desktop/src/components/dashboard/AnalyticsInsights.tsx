import { useEffect, useState } from "react";

import {
  fetchApplicationsOverTime,
  fetchCompanyFunnels,
  fetchFunnel,
  fetchTimeToOffer,
} from "../../api/analytics";
import type {
  ApplicationsOverTime,
  CompanyFunnels,
  Funnel,
  TimeToOffer,
} from "../../types/analytics";

interface InsightsData {
  funnel: Funnel;
  overTime: ApplicationsOverTime;
  timeToOffer: TimeToOffer;
  companies: CompanyFunnels;
}

/**
 * Dashboard analytics section (FEAT-7-UI): conversion funnel, applications over
 * time, time-to-offer, and a per-company breakdown. Fetches the four analytics
 * endpoints itself so the parent Dashboard stays thin.
 */
export function AnalyticsInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchFunnel(),
      fetchApplicationsOverTime(),
      fetchTimeToOffer(),
      fetchCompanyFunnels(),
    ])
      .then(([funnel, overTime, timeToOffer, companies]) => {
        if (active) setData({ funnel, overTime, timeToOffer, companies });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <Card title="Insights">
        <p className="text-sm text-gray-500">
          Couldn’t load analytics right now.
        </p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="Insights">
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <p className="mt-3 text-xs text-gray-400">Loading insights…</p>
      </Card>
    );
  }

  if (data.funnel.total === 0) {
    return (
      <Card title="Insights">
        <p className="text-sm text-gray-500">
          Insights will appear once you’ve tracked a few applications.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-sm font-medium text-gray-700">Insights</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConversionRates funnel={data.funnel} />
        <TimeToOfferCard tto={data.timeToOffer} />
        <ApplicationsOverTimeChart data={data.overTime} />
        <CompanyBreakdown data={data.companies} />
      </div>
    </div>
  );
}

/* ============================================================
   Presentational widgets
============================================================ */

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-white p-5 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function ConversionRates({ funnel }: { funnel: Funnel }) {
  const rates = [
    { label: "Response rate", value: funnel.responseRate },
    { label: "Interview rate", value: funnel.interviewRate },
    { label: "Offer rate", value: funnel.offerRate },
  ];
  return (
    <Card title="Conversion rates">
      <dl className="grid grid-cols-3 gap-4">
        {rates.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-gray-500">{r.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{pct(r.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function TimeToOfferCard({ tto }: { tto: TimeToOffer }) {
  return (
    <Card title="Time to offer">
      {tto.offers === 0 ? (
        <p className="text-sm text-gray-500">No offers yet.</p>
      ) : (
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-gray-500">Offers</dt>
            <dd className="mt-1 text-2xl font-semibold">{tto.offers}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Avg days</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {tto.averageDays ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Median days</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {tto.medianDays ?? "—"}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

/** "YYYY-MM" → "Mon" (e.g. "2026-06" → "Jun"). Falls back to the raw period. */
function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "short",
  });
}

function ApplicationsOverTimeChart({ data }: { data: ApplicationsOverTime }) {
  const max = data.points.reduce((m, p) => Math.max(m, p.count), 0) || 1;
  const total = data.points.reduce((sum, p) => sum + p.count, 0);
  return (
    <Card title="Applications over time">
      <p className="-mt-2 mb-3 text-xs text-gray-500">
        Applications submitted per month
      </p>
      {data.points.length === 0 || total === 0 ? (
        <p className="text-sm text-gray-500">
          No applications submitted yet — this chart fills in as you log jobs.
        </p>
      ) : (
        <div className="flex h-32 items-end gap-2 border-b border-gray-200">
          {data.points.map((p) => (
            <div
              key={p.period}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${p.period}: ${p.count} application${p.count === 1 ? "" : "s"}`}
            >
              <span className="text-[10px] font-medium text-gray-600">
                {p.count}
              </span>
              <div
                className="w-full rounded-t bg-blue-400"
                style={{
                  height: `${Math.max((p.count / max) * 100, p.count > 0 ? 4 : 0)}%`,
                }}
                data-testid="bar"
              />
              <span className="text-[10px] text-gray-500">
                {monthLabel(p.period)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CompanyBreakdown({ data }: { data: CompanyFunnels }) {
  return (
    <Card title="By company">
      {data.companies.length === 0 ? (
        <p className="text-sm text-gray-500">No companies yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 font-medium">Company</th>
              <th className="py-1 text-right font-medium">Applied</th>
              <th className="py-1 text-right font-medium">Interview</th>
              <th className="py-1 text-right font-medium">Offer</th>
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.companies.slice(0, 5).map((c) => (
              <tr key={c.company} className="border-t">
                <td className="py-1">{c.company}</td>
                <td className="py-1 text-right">{c.applied}</td>
                <td className="py-1 text-right">{c.interviewing}</td>
                <td className="py-1 text-right">{c.offer}</td>
                <td className="py-1 text-right font-medium">{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
