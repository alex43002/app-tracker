import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  fetchCompanyDirectory,
  fetchDiscoveredJobs,
  fetchDiscoverySources,
  fetchLocationFacets,
  ingestBoard,
  resolveBoardToken,
} from "../../api/discovery";
import { fetchPreferences, updatePreferences } from "../../api/preferences";
import {
  checkJobAlert,
  createJobAlert,
  deleteJobAlert,
  fetchJobAlerts,
  updateJobAlert,
} from "../../api/jobAlerts";
import { fetchJobs, fetchJobResumes } from "../../api/jobs";
import { scoreMatch } from "../../api/match";
import {
  NO_LOCATION_FILTER,
  type AlertCriteria,
  type CompanyDirectoryEntry,
  type DiscoveredJob,
  type DiscoveryFilters,
  type JobAlert,
  type LocationFacet,
  type Preferences,
} from "../../types/discovery";
import type { Job, JobResume } from "../../types/job";

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

/**
 * All state, effects, and handlers for the Discover page. The page component
 * and its child panels are presentational: they read values and call handlers
 * from this hook, which owns the query/filter state, board ingestion, saved
 * searches, company preferences, and résumé-fit ranking.
 */
export function useDiscovery() {
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

  function handlePageChange(page: number) {
    setFilters((p) => ({ ...p, page }));
  }

  return {
    // query + results
    filters,
    setFilter,
    jobs,
    displayedJobs,
    totalPages,
    totalItems,
    loading,
    handlePageChange,
    // ingest
    sources,
    ingestSource,
    setIngestSource,
    boardToken,
    setBoardToken,
    companyName,
    setCompanyName,
    importing,
    careersUrl,
    setCareersUrl,
    resolving,
    directory,
    handleResolveUrl,
    handlePickCompany,
    handleImport,
    // guided location
    locationFacets,
    noLocationCount,
    NO_LOCATION_FILTER,
    // alerts
    alerts,
    alertName,
    setAlertName,
    handleSaveAlert,
    handleCheckAlert,
    handleToggleNotify,
    handleDeleteAlert,
    // preferences
    prefs,
    showPrefs,
    setShowPrefs,
    newPreferred,
    setNewPreferred,
    newHidden,
    setNewHidden,
    savePrefs,
    handleHideCompany,
    // résumé-fit
    myJobs,
    fitJobId,
    setFitJobId,
    fitResumes,
    fitResumeId,
    setFitResumeId,
    fitById,
    ranking,
    sortByFit,
    setSortByFit,
    handleRankByFit,
  };
}

export type DiscoveryController = ReturnType<typeof useDiscovery>;
