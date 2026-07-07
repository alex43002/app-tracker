import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import {
  fetchCompanyDirectory,
  fetchDiscoveredJobs,
  fetchDiscoverySources,
  fetchLocationFacets,
  ingestBoard,
  resolveBoardToken,
} from "../api/discovery";
import { fetchPreferences, updatePreferences } from "../api/preferences";
import {
  checkJobAlert,
  createJobAlert,
  deleteJobAlert,
  fetchJobAlerts,
  updateJobAlert,
} from "../api/jobAlerts";
import { fetchJobs, fetchJobResumes } from "../api/jobs";
import { scoreMatch } from "../api/match";
import { JobCard } from "../components/discovery/JobCard";
import {
  NO_LOCATION_FILTER,
  type AlertCriteria,
  type CompanyDirectoryEntry,
  type DiscoveredJob,
  type DiscoveryFilters,
  type JobAlert,
  type LocationFacet,
  type Preferences,
} from "../types/discovery";
import type { Job, JobResume } from "../types/job";

// Discovery-filter keys that make up a saved search's criteria.
const CRITERIA_KEYS: (keyof DiscoveryFilters)[] = [
  "q",
  "company",
  "location",
  "workArrangement",
  "employmentType",
  "source",
  "salaryMin",
  "experienceLevel",
  "requiresDegree",
  "sponsorshipAvailable",
  "clearanceRequired",
  "maxAgeDays",
  "minQuality",
];

function criteriaFromFilters(filters: DiscoveryFilters): AlertCriteria {
  const out: AlertCriteria = {};
  for (const key of CRITERIA_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== "") {
      out[key] = value as string | number | boolean;
    }
  }
  return out;
}

function criteriaSummary(criteria: AlertCriteria): string {
  const parts = Object.entries(criteria).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(" · ") : "any posting";
}

const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
  "temporary",
];
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead"];
const WORK_ARRANGEMENTS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export function Discovery() {
  const [filters, setFilters] = useState<DiscoveryFilters>({
    page: 1,
    pageSize: 25,
    sortBy: "postedAt",
    sortOrder: "desc",
    collapse: true,
  });
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  // Ingest form
  const [sources, setSources] = useState<string[]>([]);
  const [ingestSource, setIngestSource] = useState("");
  const [boardToken, setBoardToken] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [importing, setImporting] = useState(false);
  // Friendlier board-token discovery (FEAT-23).
  const [careersUrl, setCareersUrl] = useState("");
  const [resolving, setResolving] = useState(false);
  const [directory, setDirectory] = useState<CompanyDirectoryEntry[]>([]);

  // Guided location filter (FEAT-30): real locations to suggest + no-location count.
  const [locationFacets, setLocationFacets] = useState<LocationFacet[]>([]);
  const [noLocationCount, setNoLocationCount] = useState(0);

  // Saved searches / job alerts
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [alertName, setAlertName] = useState("");

  // Company preferences
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [newPreferred, setNewPreferred] = useState("");
  const [newHidden, setNewHidden] = useState("");

  // Résumé-fit ranking
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [fitJobId, setFitJobId] = useState("");
  const [fitResumes, setFitResumes] = useState<JobResume[]>([]);
  const [fitResumeId, setFitResumeId] = useState("");
  const [fitById, setFitById] = useState<Record<string, number>>({});
  const [ranking, setRanking] = useState(false);
  const [sortByFit, setSortByFit] = useState(false);

  const setFilter = useCallback(
    <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) => {
      // BUG-25: don't clear the active résumé-fit ranking when a filter
      // changes. Applying a filter must combine with the full set of active
      // filters *and* the current ranking; the auto-rank effect below re-scores
      // the newly-filtered postings instead of resetting the ranking state.
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    [],
  );

  // Load the guided location options (FEAT-30). Re-run after an import so newly
  // ingested locations show up in the picker.
  const loadLocationFacets = useCallback(() => {
    fetchLocationFacets()
      .then((res) => {
        setLocationFacets(res.locations);
        setNoLocationCount(res.noLocationCount);
      })
      .catch(() => {
        /* the guided picker is optional; fall back to free text */
      });
  }, []);

  // Load supported sources + the user's jobs (for the fit picker) once.
  useEffect(() => {
    loadLocationFacets();
    fetchDiscoverySources()
      .then((s) => {
        setSources(s);
        setIngestSource((cur) => cur || s[0] || "");
      })
      .catch(() => toast.error("Failed to load sources"));
    fetchJobs(1, 100, "createdAt", "desc")
      .then((res) => setMyJobs(res.items))
      .catch(() => {
        /* fit ranking is optional; ignore */
      });
    fetchPreferences()
      .then(setPrefs)
      .catch(() => {
        /* preferences are optional; ignore */
      });
    fetchJobAlerts()
      .then(setAlerts)
      .catch(() => {
        /* alerts are optional; ignore */
      });
    fetchCompanyDirectory()
      .then(setDirectory)
      .catch(() => {
        /* the company picker is optional; ignore */
      });
  }, [loadLocationFacets]);

  // Paste a careers URL → fill source + board token (FEAT-23).
  async function handleResolveUrl() {
    if (!careersUrl.trim()) return;
    setResolving(true);
    try {
      const { source, boardToken: token } = await resolveBoardToken(
        careersUrl.trim(),
      );
      setIngestSource(source);
      setBoardToken(token);
      toast.success(`Found ${source} board "${token}"`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't read that URL",
      );
    } finally {
      setResolving(false);
    }
  }

  // Pick a company from the curated directory → fill the import form (FEAT-23).
  function handlePickCompany(name: string) {
    const match = directory.find((c) => c.name === name);
    if (!match) return;
    setIngestSource(match.source);
    setBoardToken(match.boardToken);
    setCompanyName(match.name);
  }

  async function handleSaveAlert() {
    if (!alertName.trim()) return;
    try {
      const created = await createJobAlert(
        alertName.trim(),
        criteriaFromFilters(filters),
      );
      setAlerts((prev) => [...prev, created]);
      setAlertName("");
      toast.success("Saved search created");
    } catch {
      toast.error("Failed to save search");
    }
  }

  async function handleCheckAlert(alert: JobAlert) {
    try {
      const { newMatches, total } = await checkJobAlert(alert.id);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id ? { ...a, lastMatchCount: newMatches } : a,
        ),
      );
      toast.success(`${newMatches} new · ${total} total match this search`);
    } catch {
      toast.error("Failed to check saved search");
    }
  }

  async function handleToggleNotify(alert: JobAlert) {
    try {
      const updated = await updateJobAlert(alert.id, { notify: !alert.notify });
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)));
    } catch {
      toast.error("Failed to update alert");
    }
  }

  async function handleDeleteAlert(alert: JobAlert) {
    try {
      await deleteJobAlert(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch {
      toast.error("Failed to delete saved search");
    }
  }

  async function savePrefs(patch: Partial<Preferences>) {
    try {
      const updated = await updatePreferences(patch);
      setPrefs(updated);
      // Re-run the query so the change is reflected immediately.
      setFilters((p) => ({ ...p, page: 1 }));
    } catch {
      toast.error("Failed to save preferences");
    }
  }

  function handleHideCompany(company: string) {
    if (!prefs) return;
    if (prefs.hiddenCompanies.includes(company)) return;
    setFilters((p) => ({ ...p, applyPreferences: true, page: 1 }));
    savePrefs({ hiddenCompanies: [...prefs.hiddenCompanies, company] });
    toast.success(`Hidden ${company}`);
  }

  // Debounced fetch whenever filters change.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetchDiscoveredJobs(filters)
        .then((res) => {
          if (!active) return;
          setJobs(res.items);
          setTotalPages(res.meta.totalPages);
          setTotalItems(res.meta.totalItems);
        })
        .catch(() => active && toast.error("Failed to load postings"))
        .finally(() => active && setLoading(false));
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [filters]);

  // Load résumés for the selected fit job.
  useEffect(() => {
    if (!fitJobId) {
      setFitResumes([]);
      setFitResumeId("");
      return;
    }
    fetchJobResumes(fitJobId)
      .then((list) => {
        setFitResumes(list);
        setFitResumeId(list.length === 1 ? list[0].id : "");
      })
      .catch(() => toast.error("Failed to load résumés"));
  }, [fitJobId]);

  async function handleImport() {
    if (!ingestSource || !boardToken.trim()) return;
    setImporting(true);
    try {
      const res = await ingestBoard(
        ingestSource,
        boardToken.trim(),
        companyName.trim() || undefined,
      );
      toast.success(
        `Imported ${res.company}: ${res.inserted} new, ${res.updated} updated`,
      );
      setBoardToken("");
      setCompanyName("");
      // Refresh the list + the guided location options (FEAT-30).
      setFilters((prev) => ({ ...prev, page: 1 }));
      loadLocationFacets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // Score any postings in `jobList` we haven't scored yet against the selected
  // résumé and turn the ranking on. Cached scores are reused so re-ranking after
  // a filter/page change only fetches the genuinely new postings (BUG-25).
  const rankJobs = useCallback(
    async (jobList: DiscoveredJob[]) => {
      if (!fitResumeId || jobList.length === 0) return;
      setSortByFit(true);
      const missing = jobList.filter((job) => fitById[job.id] === undefined);
      if (missing.length === 0) return;
      setRanking(true);
      try {
        const entries = await Promise.all(
          missing.map(async (job) => {
            try {
              const res = await scoreMatch({
                resumeId: fitResumeId,
                jobDescription: job.description,
              });
              return [job.id, res.score] as const;
            } catch {
              return [job.id, 0] as const;
            }
          }),
        );
        setFitById((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      } catch {
        toast.error("Failed to rank by résumé fit");
      } finally {
        setRanking(false);
      }
    },
    [fitResumeId, fitById],
  );

  function handleRankByFit() {
    void rankJobs(jobs);
  }

  // Changing the selected résumé invalidates cached scores (they were computed
  // against a different résumé), so clear the cache and the active ranking.
  useEffect(() => {
    setFitById({});
    setSortByFit(false);
  }, [fitResumeId]);

  // BUG-25: keep the ranking live across filter/page changes. When a ranking is
  // active, automatically score any newly-loaded postings instead of dropping
  // the ranking, so the displayed order reflects the full active filter set
  // together with the selected résumé fit.
  useEffect(() => {
    if (!sortByFit || !fitResumeId) return;
    const missing = jobs.filter((job) => fitById[job.id] === undefined);
    if (missing.length === 0) return;
    void rankJobs(jobs);
  }, [jobs, sortByFit, fitResumeId, fitById, rankJobs]);

  const displayedJobs = useMemo(() => {
    if (!sortByFit) return jobs;
    return [...jobs].sort(
      (a, b) => (fitById[b.id] ?? -1) - (fitById[a.id] ?? -1),
    );
  }, [jobs, sortByFit, fitById]);

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Discover</h1>
          <p className="text-sm text-gray-500">
            Browse aggregated public postings from supported ATS systems.
            Filter, spot low-quality or stale listings, and rank by how well
            they match your résumé.
          </p>
        </div>

        {/* Import a board (FEAT-23: friendlier board-token discovery) */}
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
                onChange={(e) => handlePickCompany(e.target.value)}
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
                onKeyDown={(e) => e.key === "Enter" && handleResolveUrl()}
                placeholder="https://boards.greenhouse.io/stripe"
                className="w-full min-w-48 rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={handleResolveUrl}
              disabled={resolving || !careersUrl.trim()}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {resolving ? "Reading…" : "Detect token"}
            </button>
          </div>

          {/* Resolved/manual fields. */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Source
              </span>
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
              onClick={handleImport}
              disabled={importing || !boardToken.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {importing ? "Importing…" : "Import board"}
            </button>
          </div>

          <p className="text-xs text-gray-500">
            A <span className="font-medium">board token</span> is the company
            slug in its careers URL — e.g. <code>stripe</code> in{" "}
            <code>boards.greenhouse.io/stripe</code> or{" "}
            <code>jobs.lever.co/stripe</code>. Pick a popular company, paste a
            careers URL and we'll extract it, or type it directly.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-4">
          <input
            value={filters.q ?? ""}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search title…"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          {/* Guided location filter (FEAT-30): suggest real locations and
              offer a "no location listed" option instead of free-form text. */}
          <div className="flex flex-col gap-1">
            <input
              list="location-facets"
              value={
                filters.location === NO_LOCATION_FILTER
                  ? ""
                  : (filters.location ?? "")
              }
              disabled={filters.location === NO_LOCATION_FILTER}
              onChange={(e) =>
                setFilter("location", e.target.value || undefined)
              }
              placeholder="City, state, or region"
              className="rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
            />
            <datalist id="location-facets">
              {locationFacets.map((l) => (
                <option
                  key={l.value}
                  value={l.value}
                  label={`${l.count} posting${l.count === 1 ? "" : "s"}`}
                />
              ))}
            </datalist>
            {noLocationCount > 0 && (
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={filters.location === NO_LOCATION_FILTER}
                  onChange={(e) =>
                    setFilter(
                      "location",
                      e.target.checked ? NO_LOCATION_FILTER : undefined,
                    )
                  }
                />
                No location listed ({noLocationCount})
              </label>
            )}
          </div>
          <select
            value={filters.workArrangement ?? ""}
            onChange={(e) => setFilter("workArrangement", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any location type</option>
            {WORK_ARRANGEMENTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <select
            value={filters.employmentType ?? ""}
            onChange={(e) => setFilter("employmentType", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any type</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filters.experienceLevel ?? ""}
            onChange={(e) => setFilter("experienceLevel", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any level</option>
            {EXPERIENCE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={10000}
            value={filters.salaryMin ?? ""}
            onChange={(e) =>
              setFilter(
                "salaryMin",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            placeholder="Min salary"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={
              filters.requiresDegree === undefined
                ? ""
                : String(filters.requiresDegree)
            }
            onChange={(e) =>
              setFilter(
                "requiresDegree",
                e.target.value === "" ? undefined : e.target.value === "true",
              )
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Degree: any</option>
            <option value="false">No degree required</option>
            <option value="true">Degree required</option>
          </select>
          <select
            value={filters.maxAgeDays ?? ""}
            onChange={(e) =>
              setFilter(
                "maxAgeDays",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Any age</option>
            <option value="7">Past week</option>
            <option value="14">Past 2 weeks</option>
            <option value="30">Past month</option>
          </select>
          <select
            value={
              filters.sponsorshipAvailable === undefined
                ? ""
                : String(filters.sponsorshipAvailable)
            }
            onChange={(e) =>
              setFilter(
                "sponsorshipAvailable",
                e.target.value === "" ? undefined : e.target.value === "true",
              )
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Sponsorship: any</option>
            <option value="true">Sponsors visa</option>
            <option value="false">No sponsorship</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={filters.minQuality === 60}
              onChange={(e) =>
                setFilter("minQuality", e.target.checked ? 60 : undefined)
              }
            />
            Hide low-quality
          </label>
        </div>

        {/* Preference controls */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={filters.applyPreferences ?? false}
              onChange={(e) => setFilter("applyPreferences", e.target.checked)}
            />
            Apply my preferences (hide avoided companies/types)
          </label>
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={filters.preferredOnly ?? false}
              onChange={(e) => setFilter("preferredOnly", e.target.checked)}
            />
            Preferred employers only
          </label>
          <button
            onClick={() => setShowPrefs((s) => !s)}
            className="ml-auto text-blue-600 hover:underline"
          >
            {showPrefs ? "Hide" : "Manage"} preferences
          </button>
        </div>

        {showPrefs && prefs && (
          <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
            <PreferenceList
              title="Preferred employers"
              items={prefs.preferredCompanies}
              value={newPreferred}
              onChange={setNewPreferred}
              onAdd={() => {
                if (!newPreferred.trim()) return;
                savePrefs({
                  preferredCompanies: [
                    ...prefs.preferredCompanies,
                    newPreferred.trim(),
                  ],
                });
                setNewPreferred("");
              }}
              onRemove={(c) =>
                savePrefs({
                  preferredCompanies: prefs.preferredCompanies.filter(
                    (x) => x !== c,
                  ),
                })
              }
            />
            <PreferenceList
              title="Hidden companies"
              items={prefs.hiddenCompanies}
              value={newHidden}
              onChange={setNewHidden}
              onAdd={() => {
                if (!newHidden.trim()) return;
                savePrefs({
                  hiddenCompanies: [...prefs.hiddenCompanies, newHidden.trim()],
                });
                setNewHidden("");
              }}
              onRemove={(c) =>
                savePrefs({
                  hiddenCompanies: prefs.hiddenCompanies.filter((x) => x !== c),
                })
              }
            />
          </div>
        )}

        {/* Saved searches & alerts */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Save this search as an alert:
            </span>
            <input
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveAlert()}
              placeholder="e.g. Remote senior Python"
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleSaveAlert}
              disabled={!alertName.trim()}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              Save search
            </button>
            <span className="text-xs text-gray-400">
              Get notified when new matching postings are imported.
            </span>
          </div>

          {alerts.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-gray-800">
                      {alert.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {criteriaSummary(alert.criteria)}
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={alert.notify}
                      onChange={() => handleToggleNotify(alert)}
                    />
                    notify
                  </label>
                  <button
                    onClick={() => handleCheckAlert(alert)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Check now
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Résumé-fit ranking */}
        {myJobs.length > 0 && (
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
                {fitResumes.length === 0
                  ? "No résumés on job"
                  : "Pick a résumé…"}
              </option>
              {fitResumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.filename ?? r.id}
                </option>
              ))}
            </select>
            <button
              onClick={handleRankByFit}
              disabled={!fitResumeId || ranking || jobs.length === 0}
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
        )}

        {/* Results */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{loading ? "Loading…" : `${totalItems} listings`}</span>
          <span>
            Page {filters.page} of {Math.max(totalPages, 1)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {!loading && jobs.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              No postings match. Import a company board above, or relax your
              filters.
            </div>
          ) : (
            displayedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                fit={sortByFit ? fitById[job.id] : undefined}
                onHideCompany={prefs ? handleHideCompany : undefined}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pb-4">
            <button
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  page: Math.max(1, (p.page ?? 1) - 1),
                }))
              }
              disabled={(filters.page ?? 1) <= 1}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  page: Math.min(totalPages, (p.page ?? 1) + 1),
                }))
              }
              disabled={(filters.page ?? 1) >= totalPages}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PreferenceList({
  title,
  items,
  value,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (item: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="mb-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="Company name"
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={onAdd}
          className="rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900"
        >
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">None yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
            >
              {item}
              <button
                onClick={() => onRemove(item)}
                className="text-gray-500 hover:text-red-600"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
