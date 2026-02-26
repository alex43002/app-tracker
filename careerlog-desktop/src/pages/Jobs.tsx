import { useEffect, useState } from "react";
import { confirm } from "../components/common/dialogs/ConfirmDialog";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import { PageScroll } from "../components/common/PageScroll";

import { JobsHeader } from "../components/jobs/JobsHeader";
import { JobsToolbar } from "../components/jobs/JobsToolbar";
import { JobsTable } from "../components/jobs/JobsTable";
import { JobsPagination } from "../components/jobs/JobsPagination";
import { JobFormModal } from "../components/jobs/JobFormModal";

import { fetchCurrentUser } from "../api/users";
import {
  fetchJobs,
  createJob,
  updateJob,
  deleteJob,
  fetchJobResume,
  type CreateJobPayload,
  type UpdateJobPayload,
} from "../api/jobs";

import type { Job } from "../types/job";
import type { User } from "../types/user";

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
  } catch (err) {
    toast.error("Failed to delete job");
  }
}

export function Jobs() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("desc");

  /* ============================================================
     Bootstrap user
  ============================================================ */

  useEffect(() => {
    fetchCurrentUser().then((u: User) => {
      setUser(u);
    });
  }, []);

  /* ============================================================
     Fetch jobs
  ============================================================ */

  useEffect(() => {
    setLoading(true);

    fetchJobs(
      page,
      PAGE_SIZE,
      sortBy,
      sortOrder,
      Object.keys(filters).length ? filters : undefined
    ).then((res) => {
      setJobs(res.items);
      setTotalItems(res.meta.totalItems);
      setLoading(false);
    });
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
    <AppLayout user={user}>
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

            <JobsToolbar
              filters={filters}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onChange={({ filters, sortBy, sortOrder }) => {
                setPage(1);
                setFilters(filters);
                setSortBy(sortBy);
                setSortOrder(sortOrder);
              }}
            />

            <JobsTable
              jobs={jobs}
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
