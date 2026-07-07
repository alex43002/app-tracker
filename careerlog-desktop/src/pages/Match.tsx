import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { fetchJobs, fetchJobResumes } from "../api/jobs";
import { extractResume, scoreMatch } from "../api/match";
import { ScoreResult } from "../components/match/ScoreResult";
import { buildMatchReport, matchReportFilename } from "../lib/matchReport";
import { renderMatchReportPdf } from "../lib/matchReportPdf";
import type { Job, JobResume } from "../types/job";
import type { MatchScore, ResumeExtractResult } from "../types/match";

type JobSource = "url" | "text";
type ResumeSource = "saved" | "upload";

/** Context captured at scoring time so an exported report matches the result. */
interface ReportContext {
  jobTitle?: string;
  company?: string;
  resumeLabel: string;
  jobSourceLabel: string;
}

// Résumé formats the backend can extract text from (mirrors ALLOWED_RESUME_TYPES).
const RESUME_ACCEPT = ".pdf,.doc,.docx,.txt";

export function Match() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [selectedJobId, setSelectedJobId] = useState("");
  const [resumes, setResumes] = useState<JobResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");

  // Résumé source: an existing attachment or an ad-hoc file the user uploads
  // here (extracted to text and scored without being saved to the job).
  const [resumeSource, setResumeSource] = useState<ResumeSource>("saved");
  const [uploadedResume, setUploadedResume] =
    useState<ResumeExtractResult | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [jobSource, setJobSource] = useState<JobSource>("url");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<MatchScore | null>(null);
  // Snapshot of the inputs behind `result`, used to label the exported report.
  const [reportContext, setReportContext] = useState<ReportContext | null>(
    null,
  );

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  // Load the user's jobs once to populate the picker.
  useEffect(() => {
    let active = true;
    fetchJobs(1, 100, "createdAt", "desc")
      .then((res) => {
        if (active) setJobs(res.items);
      })
      .catch(() => toast.error("Failed to load jobs"))
      .finally(() => {
        if (active) setLoadingJobs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // When the job changes, load its résumés and prefill the posting URL.
  useEffect(() => {
    if (!selectedJobId) {
      setResumes([]);
      setSelectedResumeId("");
      return;
    }
    let active = true;
    setSelectedResumeId("");
    fetchJobResumes(selectedJobId)
      .then((list) => {
        if (!active) return;
        setResumes(list);
        // Auto-select when there's exactly one résumé — the common case.
        if (list.length === 1) setSelectedResumeId(list[0].id);
      })
      .catch(() => toast.error("Failed to load résumés for this job"));

    setJobUrl(selectedJob?.url ?? "");
    return () => {
      active = false;
    };
  }, [selectedJobId, selectedJob]);

  const hasResume =
    resumeSource === "saved" ? !!selectedResumeId : !!uploadedResume;
  const canScore =
    hasResume &&
    (jobSource === "url" ? jobUrl.trim() !== "" : jobDescription.trim() !== "");

  // Extract text from an uploaded file so it can be scored as `resumeText`.
  async function handleResumeFile(file: File | undefined) {
    if (!file) return;
    setExtracting(true);
    setUploadedResume(null);
    setResult(null);
    try {
      const res = await extractResume(file);
      setUploadedResume(res);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not read this résumé file";
      toast.error(message);
    } finally {
      setExtracting(false);
    }
  }

  // Describe the résumé/job inputs for the exported report's header.
  function currentReportContext(): ReportContext {
    const savedName = resumes.find((r) => r.id === selectedResumeId)?.filename;
    return {
      jobTitle: selectedJob?.jobTitle,
      company: selectedJob?.company,
      resumeLabel:
        resumeSource === "saved"
          ? (savedName ?? "Saved résumé")
          : uploadedResume?.filename || "Uploaded résumé",
      jobSourceLabel:
        jobSource === "url"
          ? `Scraped from ${jobUrl.trim() || "posting URL"}`
          : "Pasted description",
    };
  }

  async function handleScore() {
    if (!canScore) return;
    setScoring(true);
    setResult(null);
    setReportContext(null);
    try {
      const resumePart =
        resumeSource === "saved"
          ? { resumeId: selectedResumeId }
          : { resumeText: uploadedResume?.text };
      const jobPart =
        jobSource === "url"
          ? { jobUrl: jobUrl.trim() }
          : { jobDescription: jobDescription.trim() };
      const res = await scoreMatch({ ...resumePart, ...jobPart });
      setResult(res);
      setReportContext(currentReportContext());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not score this résumé";
      toast.error(message);
    } finally {
      setScoring(false);
    }
  }

  // Build the explainable report from the scored result and save it as a PDF.
  function handleDownloadReport() {
    if (!result || !reportContext) return;
    try {
      const report = buildMatchReport({ result, ...reportContext });
      const doc = renderMatchReportPdf(report);
      doc.save(
        matchReportFilename({
          jobTitle: reportContext.jobTitle,
          company: reportContext.company,
          generatedAt: report.generatedAt,
        }),
      );
    } catch {
      toast.error("Could not generate the PDF report");
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Match</h1>
          <p className="text-sm text-gray-500">
            Score a résumé against a job posting before you apply, and see
            exactly which skills and keywords you're missing. Use one you've
            saved to the job or upload a file to check on the spot.
          </p>
        </div>

        {loadingJobs ? (
          <div className="rounded border p-6 text-sm text-gray-500">
            Loading your jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            Add a job on the Jobs page first, then come back here to check your
            match — you can score a saved résumé or upload one on the spot.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ---------------- Inputs ---------------- */}
            <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
              {/* Job picker */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Job
                </span>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a job…</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobTitle} — {j.company}
                    </option>
                  ))}
                </select>
              </label>

              {/* Résumé source */}
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Résumé
                </span>
                <div className="mb-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={resumeSource === "saved"}
                      onChange={() => setResumeSource("saved")}
                    />
                    Saved résumé
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={resumeSource === "upload"}
                      onChange={() => setResumeSource("upload")}
                    />
                    Upload a file
                  </label>
                </div>

                {resumeSource === "saved" ? (
                  <>
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      disabled={!selectedJobId || resumes.length === 0}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">
                        {!selectedJobId
                          ? "Select a job first"
                          : resumes.length === 0
                            ? "No résumés attached to this job"
                            : "Select a résumé…"}
                      </option>
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.filename ?? r.id}
                        </option>
                      ))}
                    </select>
                    {selectedJobId && resumes.length === 0 && (
                      <span className="mt-1 block text-xs text-amber-700">
                        Attach a résumé to this job on the Jobs page, or choose
                        “Upload a file” to score one you haven't saved.
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      accept={RESUME_ACCEPT}
                      onChange={(e) => handleResumeFile(e.target.files?.[0])}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm"
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      PDF, DOCX, or TXT up to 5&nbsp;MB. The file is only used
                      for this score — it isn't saved to the job.
                    </span>
                    {extracting && (
                      <span className="mt-1 block text-xs text-gray-500">
                        Reading résumé…
                      </span>
                    )}
                    {uploadedResume && !extracting && (
                      <span className="mt-1 block text-xs text-green-700">
                        Ready: {uploadedResume.filename || "résumé"} (
                        {uploadedResume.skills.length} skills detected)
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Job description source */}
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Job description
                </span>
                <div className="mb-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={jobSource === "url"}
                      onChange={() => setJobSource("url")}
                    />
                    Scrape posting URL
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={jobSource === "text"}
                      onChange={() => setJobSource("text")}
                    />
                    Paste text
                  </label>
                </div>

                {jobSource === "url" ? (
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://company.com/careers/123"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                ) : (
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={8}
                    placeholder="Paste the job description here…"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                )}
              </div>

              <button
                onClick={handleScore}
                disabled={!canScore || scoring}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {scoring ? "Scoring…" : "Check my score"}
              </button>
            </div>

            {/* ---------------- Result ---------------- */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {result ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-800">
                      Your match
                    </h2>
                    <button
                      onClick={handleDownloadReport}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      title="Download a PDF report with the full breakdown and recommendations"
                    >
                      ⬇ PDF report
                    </button>
                  </div>
                  <ScoreResult result={result} />
                </div>
              ) : (
                <div className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-gray-400">
                  Pick a résumé and a job description, then run a score to see
                  your fit and gaps here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
