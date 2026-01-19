import { useEffect, useState } from "react";
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
  type CreateJobPayload,
  type UpdateJobPayload,
} from "../api/jobs";

import type { Job } from "../types/job";
import type { User } from "../types/user";

const PAGE_SIZE = 25;

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
              onEdit={(job: Job) => {
                setEditingJob(job);
                setModalOpen(true);
              }}
              onDelete={async (id: string) => {
                await deleteJob(id);
                setJobs((prev) =>
                  prev.filter((j) => j.id !== id)
                );
                setTotalItems((prev) => prev - 1);
              }}
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
                  console.log(payload);
                  const updatePayload =
                    payload as UpdateJobPayload;

                    console.log(updatePayload);
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
