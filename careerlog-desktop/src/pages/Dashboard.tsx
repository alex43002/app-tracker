import { useEffect, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { PageScroll } from "../components/common/PageScroll";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { JobStatsGrid } from "../components/dashboard/JobStatsGrid";
import { PipelineVisualization } from "../components/dashboard/PipelineVisualization";
import { RecentJobsTable } from "../components/dashboard/RecentJobsTable";
import { UpcomingAlertsList } from "../components/dashboard/UpcomingAlertsList";

import type { Job } from "../types/job";
import type { Alert } from "../types/alert";
import type { User } from "../types/user";
import type { JobStatusCounts } from "../types/analytics";

import { fetchCurrentUser } from "../api/users";
import { fetchJobs } from "../api/jobs";
import { fetchJobStatusCounts } from "../api/analytics";

/* TEMP: alerts still mocked */
const alerts: Alert[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `${i}`,
  scheduledAlert: new Date(
    Date.now() + i * 86400000
  ).toISOString(),
  smsOrEmail: i % 2 === 0 ? "email" : "sms",
  message: "Follow up with recruiter",
}));

export function Dashboard() {
  const [user, setUser] = useState<User>();

  // Table + pipeline data (still uses jobs endpoint)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Dashboard KPIs (uses analytics endpoint)
  const [jobStats, setJobStats] = useState<JobStatusCounts | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  /* ============================================================
     Fetch Current User
  ============================================================ */
  useEffect(() => {
    fetchCurrentUser().then((u) => {
      setUser(u);
    });
  }, []);

  /* ============================================================
     Fetch Jobs (for table + pipeline only)
  ============================================================ */
  useEffect(() => {
    fetchJobs(1, 50) // Fetch only what the UI needs
      .then((res) => {
        setJobs(res.items);
      })
      .finally(() => {
        setLoadingJobs(false);
      });
  }, []);

  /* ============================================================
     Fetch Analytics (for KPI cards + summary stats)
  ============================================================ */
  useEffect(() => {
    fetchJobStatusCounts()
      .then((res) => {
        console.log(res);
        setJobStats(res);
      })
      .finally(() => {
        setLoadingStats(false);
      });
  }, []);

  /* ============================================================
     Unified Loading Guard
  ============================================================ */
  if (!user || loadingJobs || loadingStats) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="text-sm text-gray-500">
            Loading dashboard…
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <PageScroll>
        <section
          className="
            mx-auto w-full max-w-7xl
            px-4 sm:px-6 lg:px-8
            py-8
          "
        >
          <div className="flex flex-col gap-10">
            <DashboardHeader />

            {/* KPI Cards should now use analytics data, not full job list */}
            <JobStatsGrid stats={jobStats} isLoading={loadingStats}/>

            {/* Pipeline visualization still relies on actual jobs */}
            <PipelineVisualization jobs={jobs} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <RecentJobsTable jobs={jobs} />
              <UpcomingAlertsList alerts={alerts} />
            </div>
          </div>
        </section>
      </PageScroll>
    </AppLayout>
  );
}