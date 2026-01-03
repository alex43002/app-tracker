import { AppLayout } from "../layouts/AppLayout";
import { PageScroll } from "../components/common/PageScroll";
import { JobsTable } from "../components/jobs/JobsTable";
import type { Job } from "../types/job";

/* TEMP: mocked API-shaped jobs */
const jobs: Job[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `${i}`,
  userId: "mock-user",
  jobId: `JOB-${1000 + i}`,
  url: "https://example.com/job",
  jobTitle: "Software Engineer",
  company: `Company ${i + 1}`,
  salaryTarget: 120000,
  salaryRange: "100000-140000",
  status: ["applied", "interviewing", "offer", "rejected"][i % 4],
  resume: "resume_v1.pdf",
  location: "Remote",
  employmentType: "full-time",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));


export function Jobs() {
  return (
    <AppLayout>
      <PageScroll>
        <div className="flex flex-col gap-8">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-semibold">Jobs</h1>
            <p className="text-sm text-gray-600">
              All of your tracked job applications
            </p>
          </div>

          {/* Jobs table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="border-b px-4 py-3 text-sm font-medium">
              Jobs
            </div>

            <JobsTable jobs={jobs} />
          </div>
        </div>
      </PageScroll>
    </AppLayout>
  );
}
