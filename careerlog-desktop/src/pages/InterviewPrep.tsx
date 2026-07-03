import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { fetchJobs } from "../api/jobs";
import { generateInterviewPrep } from "../api/interviewPrep";
import { ApiError } from "../api/client";
import type { Job } from "../types/job";
import type { PrepResult } from "../types/interviewPrep";

/* ============================================================
   Interview preparation workspace

   Turn a job description into role-specific prep notes, likely
   topics, and practice questions. Paste a description or pull one
   from a tracked job's notes. Generation is deterministic (no AI).
============================================================ */

export function InterviewPrep() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<PrepResult | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchJobs(1, 100, "createdAt", "desc")
      .then((res) => setJobs(res.items))
      .catch(() => {
        /* the job picker is optional; ignore */
      });
  }, []);

  function handlePickJob(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setTitle(job.jobTitle);
    setDescription(job.notes ?? "");
  }

  async function handleGenerate() {
    if (!description.trim()) {
      toast.error("Paste a job description first");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateInterviewPrep(description.trim(), title.trim());
      setResult(res);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.displayMessage : "Failed to generate prep"
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Interview prep</h1>
          <p className="text-sm text-gray-500">
            Turn a job description into role-specific topics, practice questions,
            and prep notes.
          </p>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            {jobs.length > 0 && (
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">
                  Pull from a tracked job
                </span>
                <select
                  onChange={(e) => handlePickJob(e.target.value)}
                  defaultValue=""
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="" disabled>
                    Choose a job…
                  </option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobTitle} — {j.company}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Role title (optional)
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Job description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder="Paste the full job description here…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div>
            <button
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {generating ? "Generating…" : "Generate prep"}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-1 font-semibold text-gray-900">Prep notes</h2>
              <p className="text-sm leading-relaxed text-gray-700">
                {result.notes}
              </p>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-2 font-semibold text-gray-900">Likely topics</h2>
              {result.topics.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No specific topics detected.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {result.topics.map((t) => (
                    <li
                      key={`${t.kind}:${t.name}`}
                      className={`rounded-full px-2.5 py-0.5 text-xs ${
                        t.kind === "skill"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <QuestionList
                title="Technical questions"
                questions={result.technicalQuestions}
              />
              <QuestionList
                title="Behavioral questions"
                questions={result.behavioralQuestions}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function QuestionList({
  title,
  questions,
}: {
  title: string;
  questions: string[];
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-2 font-semibold text-gray-900">{title}</h2>
      {questions.length === 0 ? (
        <p className="text-sm text-gray-500">None generated.</p>
      ) : (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
