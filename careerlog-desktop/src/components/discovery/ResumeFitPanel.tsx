import type { Job, JobResume } from "../../types/job";

type Props = {
  myJobs: Job[];
  fitJobId: string;
  setFitJobId: (v: string) => void;
  fitResumes: JobResume[];
  fitResumeId: string;
  setFitResumeId: (v: string) => void;
  jobsCount: number;
  ranking: boolean;
  sortByFit: boolean;
  setSortByFit: (v: boolean) => void;
  onRank: () => void;
};

/** "Rank by résumé fit" controls — pick a tracked job's résumé and score postings. */
export function ResumeFitPanel({
  myJobs,
  fitJobId,
  setFitJobId,
  fitResumes,
  fitResumeId,
  setFitResumeId,
  jobsCount,
  ranking,
  sortByFit,
  setSortByFit,
  onRank,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <span className="text-sm font-medium text-gray-700">
        Rank by résumé fit:
      </span>
      <select
        value={fitJobId}
        onChange={(e) => setFitJobId(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Pick a job…</option>
        {myJobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.jobTitle} — {j.company}
          </option>
        ))}
      </select>
      <select
        value={fitResumeId}
        onChange={(e) => setFitResumeId(e.target.value)}
        disabled={!fitJobId || fitResumes.length === 0}
        className="rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
      >
        <option value="">
          {fitResumes.length === 0 ? "No résumés on job" : "Pick a résumé…"}
        </option>
        {fitResumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.filename ?? r.id}
          </option>
        ))}
      </select>
      <button
        onClick={onRank}
        disabled={!fitResumeId || ranking || jobsCount === 0}
        className="rounded bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:bg-gray-300"
      >
        {ranking ? "Scoring…" : "Rank these by fit"}
      </button>
      {sortByFit && (
        <button
          onClick={() => setSortByFit(false)}
          className="text-sm text-blue-600 hover:underline"
        >
          Clear ranking
        </button>
      )}
    </div>
  );
}
