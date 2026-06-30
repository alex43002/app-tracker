import { useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { classifyEmail } from "../api/emailTracking";
import { updateJob } from "../api/jobs";
import { ApiError } from "../api/client";
import type {
  EmailClassification,
  EmailMatchedJob,
} from "../types/emailTracking";

/* ============================================================
   Email-based application tracking

   Paste a recruiting email and we detect whether it's an
   application confirmation, an interview invite, a rejection, an
   offer, or recruiter outreach — then suggest a status update for the
   matching tracked job. Deterministic heuristics, no AI.
============================================================ */

const CATEGORY_LABELS: Record<string, string> = {
  offer: "Offer",
  rejection: "Rejection",
  interview: "Interview invitation",
  application_received: "Application received",
  recruiter: "Recruiter outreach",
  other: "Unrecognized",
};

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

const CATEGORY_STYLES: Record<string, string> = {
  offer: "bg-green-100 text-green-800",
  rejection: "bg-red-100 text-red-800",
  interview: "bg-blue-100 text-blue-800",
  application_received: "bg-gray-100 text-gray-700",
  recruiter: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-600",
};

export function EmailTracking() {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<EmailClassification | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // Track jobs already updated this session so the UI reflects it.
  const [appliedTo, setAppliedTo] = useState<Record<string, string>>({});

  async function handleClassify() {
    if (!text.trim()) {
      toast.error("Paste an email first");
      return;
    }
    setLoading(true);
    setAppliedTo({});
    try {
      const res = await classifyEmail(text.trim(), subject.trim());
      setResult(res);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.displayMessage : "Failed to analyze email"
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyStatus(job: EmailMatchedJob, status: string) {
    setApplyingId(job.id);
    try {
      await updateJob(job.id, { status });
      setAppliedTo((prev) => ({ ...prev, [job.id]: status }));
      toast.success(
        `Marked ${job.company} as ${STATUS_LABELS[status] ?? status}`
      );
    } catch {
      toast.error("Failed to update job");
    } finally {
      setApplyingId(null);
    }
  }

  const suggested = result?.suggestedStatus ?? null;

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Email tracking</h1>
          <p className="text-sm text-gray-500">
            Paste a recruiting email to detect confirmations, interviews,
            rejections, offers, and recruiter messages — then update the matching
            job in one click.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Subject (optional)
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Update on your application"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Email body
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste the email text here…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div>
            <button
              onClick={handleClassify}
              disabled={loading || !text.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? "Analyzing…" : "Analyze email"}
            </button>
          </div>
        </div>

        {result && (
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                    CATEGORY_STYLES[result.category] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {CATEGORY_LABELS[result.category] ?? result.category}
                </span>
                <span className="text-xs text-gray-400">
                  {result.confidence} confidence
                </span>
              </div>
              {suggested ? (
                <p className="mt-2 text-sm text-gray-700">
                  Suggested status:{" "}
                  <strong>{STATUS_LABELS[suggested] ?? suggested}</strong>
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  No status change suggested for this message.
                </p>
              )}
              {result.signals.length > 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  Detected: {result.signals.map((s) => `“${s}”`).join(", ")}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-2 font-semibold text-gray-900">Matching jobs</h2>
              {result.matchedJobs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No tracked job matched this email's company. Add the job first,
                  or update it manually on the Jobs page.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {result.matchedJobs.map((job) => (
                    <li
                      key={job.id}
                      className="flex flex-wrap items-center gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-800">
                          {job.jobTitle}
                        </span>{" "}
                        <span className="text-gray-500">— {job.company}</span>
                        <span className="ml-2 text-xs text-gray-400">
                          now: {STATUS_LABELS[job.status] ?? job.status}
                        </span>
                      </div>
                      {suggested &&
                        (appliedTo[job.id] === suggested ? (
                          <span className="text-xs font-medium text-green-700">
                            ✓ Updated
                          </span>
                        ) : (
                          <button
                            onClick={() => applyStatus(job, suggested)}
                            disabled={applyingId === job.id}
                            className="rounded border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {applyingId === job.id
                              ? "Updating…"
                              : `Mark ${STATUS_LABELS[suggested] ?? suggested}`}
                          </button>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
