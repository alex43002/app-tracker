import type { CompanyDirectoryEntry } from "../../types/discovery";

type Props = {
  sources: string[];
  ingestSource: string;
  setIngestSource: (v: string) => void;
  boardToken: string;
  setBoardToken: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  careersUrl: string;
  setCareersUrl: (v: string) => void;
  directory: CompanyDirectoryEntry[];
  importing: boolean;
  resolving: boolean;
  onResolveUrl: () => void;
  onPickCompany: (name: string) => void;
  onImport: () => void;
};

/** "Add a company's job board" panel — company picker, URL detect, manual fields. */
export function ImportBoardPanel({
  sources,
  ingestSource,
  setIngestSource,
  boardToken,
  setBoardToken,
  companyName,
  setCompanyName,
  careersUrl,
  setCareersUrl,
  directory,
  importing,
  resolving,
  onResolveUrl,
  onPickCompany,
  onImport,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-medium text-gray-700">
        Add a company's job board
      </p>

      {/* Easiest path: pick a popular company, or paste a careers URL. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Popular companies
          </span>
          <input
            list="company-directory"
            onChange={(e) => onPickCompany(e.target.value)}
            placeholder="Search a company…"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <datalist id="company-directory">
            {directory.map((c) => (
              <option key={`${c.source}:${c.boardToken}`} value={c.name} />
            ))}
          </datalist>
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            …or paste a careers URL
          </span>
          <input
            value={careersUrl}
            onChange={(e) => setCareersUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onResolveUrl()}
            placeholder="https://boards.greenhouse.io/stripe"
            className="w-full min-w-48 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={onResolveUrl}
          disabled={resolving || !careersUrl.trim()}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {resolving ? "Reading…" : "Detect token"}
        </button>
      </div>

      {/* Resolved/manual fields. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Source</span>
          <select
            value={ingestSource}
            onChange={(e) => setIngestSource(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Board token
          </span>
          <input
            value={boardToken}
            onChange={(e) => setBoardToken(e.target.value)}
            placeholder="e.g. stripe"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Company name (optional)
          </span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Display name"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={onImport}
          disabled={importing || !boardToken.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {importing ? "Importing…" : "Import board"}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        A <span className="font-medium">board token</span> is the company slug
        in its careers URL — e.g. <code>stripe</code> in{" "}
        <code>boards.greenhouse.io/stripe</code> or{" "}
        <code>jobs.lever.co/stripe</code>. Pick a popular company, paste a
        careers URL and we'll extract it, or type it directly.
      </p>
    </div>
  );
}
