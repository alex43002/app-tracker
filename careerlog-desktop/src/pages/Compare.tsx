import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { fetchAllJobs } from "../api/jobs";
import { StatusBadge } from "../components/jobs/StatusBadge";
import type { Job } from "../types/job";

/* ============================================================
   Side-by-side job comparison (FEAT-22)

   Pick several tracked jobs and compare them row-by-row on
   compensation, location, requirements, and application status.
============================================================ */

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

type Row = { label: string; render: (job: Job) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Status", render: (j) => <StatusBadge status={j.status} /> },
  { label: "Salary target", render: (j) => formatMoney(j.salaryTarget) },
  { label: "Salary range", render: (j) => j.salaryRange || "—" },
  { label: "Location", render: (j) => j.location || "—" },
  { label: "Employment type", render: (j) => j.employmentType || "—" },
  {
    label: "Posting",
    render: (j) =>
      j.url ? (
        <a
          href={j.url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 hover:underline"
        >
          Open
        </a>
      ) : (
        "—"
      ),
  },
  { label: "Reference ID", render: (j) => j.jobId || "—" },
  {
    label: "Requirements / notes",
    render: (j) => (
      <span className="whitespace-pre-wrap text-xs text-gray-600">
        {j.notes || "—"}
      </span>
    ),
  },
  {
    label: "Added",
    render: (j) => new Date(j.createdAt).toLocaleDateString(),
  },
];

export function Compare() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchAllJobs("createdAt", "desc")
      .then(setJobs)
      .catch(() => toast.error("Failed to load jobs"))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => jobs.find((j) => j.id === id))
        .filter(Boolean) as Job[],
    [selectedIds, jobs],
  );

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Compare</h1>
          <p className="text-sm text-gray-500">
            Select jobs to evaluate them side by side on compensation, location,
            requirements, and application status.
          </p>
        </div>

        {loading ? (
          <div className="rounded border p-6 text-sm text-gray-500">
            Loading jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            Add some jobs on the Jobs page first, then compare them here.
          </div>
        ) : (
          <>
            {/* Selector */}
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3">
              {jobs.map((j) => (
                <label
                  key={j.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                    selectedIds.includes(j.id)
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedIds.includes(j.id)}
                    onChange={() => toggle(j.id)}
                  />
                  {j.jobTitle} — {j.company}
                </label>
              ))}
            </div>

            {/* Comparison table */}
            {selected.length === 0 ? (
              <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                Select two or more jobs above to compare them.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="w-40 px-4 py-3 text-left font-medium text-gray-500">
                        Field
                      </th>
                      {selected.map((j) => (
                        <th
                          key={j.id}
                          className="min-w-[12rem] px-4 py-3 text-left font-semibold"
                        >
                          {j.jobTitle}
                          <span className="block text-xs font-normal text-gray-500">
                            {j.company}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-500">
                          {row.label}
                        </td>
                        {selected.map((j) => (
                          <td key={j.id} className="px-4 py-3 align-top">
                            {row.render(j)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
