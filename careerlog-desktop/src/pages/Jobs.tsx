import { useCallback, useEffect, useMemo, useState } from "react";
import { confirm } from "../components/common/dialogs/confirmController";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { PageScroll } from "../components/common/PageScroll";

import { JobsHeader } from "../components/jobs/JobsHeader";
import { JobsToolbar, type JobsQuery } from "../components/jobs/JobsToolbar";
import { JobsTable } from "../components/jobs/JobsTable";
import { JobsPagination } from "../components/jobs/JobsPagination";
import { JobFormModal } from "../components/jobs/JobFormModal";
import { SavedSearchesBar } from "../components/jobs/SavedSearchesBar";
import type { SavedSearch } from "../types/savedSearch";

import { useCurrentUser } from "../store/userContext";
import {
  fetchJobs,
  createJob,
  updateJob,
  deleteJob,
  fetchJobResume,
  type CreateJobPayload,
  type UpdateJobPayload,
} from "../api/jobs";
import { withOfflineCache } from "../api/offlineCache";
import type { PaginatedResponse } from "../api/client";

import type { Job } from "../types/job";

const PAGE_SIZE = 25;

async function handleDelete(jobId: string) {
  const ok = await confirm({
    title: "Delete this job?",
    description:
      "This action cannot be undone. The job record will be permanently removed.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    destructive: true,
  });

  if (!ok) return;

  try {
    await deleteJob(jobId);
    toast.success("Job deleted");
  } catch {
    toast.error("Failed to delete job");
  }
}

export function Jobs() {
  const { user } = useCurrentUser();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Whitelisted server-side filters (status / employmentType). Free-text search
  // is applied client-side (`search`) since the backend filter whitelist is
  // exact-match only and rejects Mongo operators (SEC-1).
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("desc");
  const [offline, setOffline] = useState(false);
  // Bumped to remount the toolbar with fresh state when a saved search is applied.
  const [toolbarKey, setToolbarKey] = useState(0);

  const handleQueryChange = useCallback((query: JobsQuery) => {
    setPage(1);
    setFilters(query.filters);
    setSearch(query.search);
    setSortBy(query.sortBy);
    setSortOrder(query.sortOrder);
  }, []);

  const applySavedSearch = useCallback((saved: SavedSearch) => {
    setPage(1);
    setSearch("");
    setFilters({ ...saved.filters });
    setSortBy(saved.sortBy);
    setSortOrder(saved.sortOrder);
    setToolbarKey((k) => k + 1);
  }, []);

  // Client-side text filter over the loaded page (company / title).
  const visibleJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.company.toLowerCase().includes(q) ||
        j.jobTitle.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  /* ============================================================
     Fetch jobs
  ============================================================ */

  useEffect(() => {
    let active = true;

    const filterArg = Object.keys(filters).length ? filters : undefined;
    // Read-through offline cache (FEAT-9): keyed by the exact query so each
    // page/sort/filter view falls back to its own last-known data when offline.
    const cacheKey = `jobs:${page}:${sortBy}:${sortOrder}:${JSON.stringify(filters)}`;

    withOfflineCache<PaginatedResponse<Job>>(cacheKey, () =>
      fetchJobs(page, PAGE_SIZE, sortBy, sortOrder, filterArg)
    )
      .then(({ data, stale }) => {
        if (!active) return;
        setJobs(data.items);
        setTotalItems(data.meta.totalItems);
        setOffline(stale);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, filters, sortBy, sortOrder]);

  /* ============================================================
     Loading guard
  ============================================================ */

  if (!user) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-gray-500">
          Loading jobs…
        </div>
      </AppLayout>
    );
  }

  /* ============================================================
     Render
  ============================================================ */

  return (
    <AppLayout>
      <PageScroll>
        {/* Page container: fixes edge crowding + ultra-wide layouts */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            <JobsHeader
              onCreate={() => {
                setEditingJob(null);
                setModalOpen(true);
              }}
            />

            {offline && (
              <div
                role="status"
                className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
              >
                You appear to be offline — showing the last data we cached.
              </div>
            )}

            <JobsToolbar
              key={toolbarKey}
              filters={{
                search,
                status: filters.status as string | undefined,
                employmentType: filters.employmentType as string | undefined,
                company: filters.company as string | undefined,
                location: filters.location as string | undefined,
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onChange={handleQueryChange}
            />

            <SavedSearchesBar
              filters={{
                status: filters.status as string | undefined,
                employmentType: filters.employmentType as string | undefined,
                company: filters.company as string | undefined,
                location: filters.location as string | undefined,
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onApply={applySavedSearch}
            />

            <JobsTable
              jobs={visibleJobs}
              loading={loading}
              onEdit={async (job: Job) => {
                let hydratedJob = job;

                if (typeof job.resume === "string") {
                  const file = await fetchJobResume(job.resume);
                  if (file) {
                    hydratedJob = { ...job, resume: file };
                  }
                }

                setEditingJob(hydratedJob);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
            />

            <JobsPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={totalItems}
              onChange={setPage}
            />

            <JobFormModal
              open={modalOpen}
              job={editingJob}
              onClose={() => setModalOpen(false)}
              onSave={async (payload) => {
                if (editingJob) {
                  const updatePayload =
                    payload as UpdateJobPayload;

                  const { updatedAt } =
                    await updateJob(
                      editingJob.id,
                      updatePayload
                    );

                  setJobs((prev) =>
                    prev.map((job) =>
                      job.id === editingJob.id
                        ? {
                            ...job,
                            ...updatePayload,
                            updatedAt,
                          }
                        : job
                    )
                  );
                } else {
                  const createPayload =
                    payload as CreateJobPayload;

                  const created =
                    await createJob(createPayload);

                  const newJob: Job = {
                    id: created.id,
                    userId: user.id,

                    jobId:
                      createPayload.jobId ?? null,
                    url: createPayload.url,
                    jobTitle:
                      createPayload.jobTitle,
                    company:
                      createPayload.company,
                    salaryTarget:
                      createPayload.salaryTarget,
                    salaryRange:
                      createPayload.salaryRange ??
                      null,
                    status:
                      createPayload.status,
                    resume:
                      createPayload.resume,
                    location:
                      createPayload.location,
                    employmentType:
                      createPayload.employmentType,

                    createdAt:
                      created.createdAt,
                    updatedAt:
                      created.updatedAt,
                  };

                  setJobs((prev) => [
                    newJob,
                    ...prev,
                  ]);
                  setTotalItems(
                    (prev) => prev + 1
                  );
                }

                setModalOpen(false);
              }}
            />
          </div>
        </div>
      </PageScroll>
    </AppLayout>
  );
}
