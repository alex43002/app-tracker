import { useEffect, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { PageScroll } from "../components/common/PageScroll";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { JobStatsGrid } from "../components/dashboard/JobStatsGrid";
import { PipelineVisualization } from "../components/dashboard/PipelineVisualization";
import { AnalyticsInsights } from "../components/dashboard/AnalyticsInsights";
import { RecentJobsTable } from "../components/dashboard/RecentJobsTable";
import { UpcomingAlertsList } from "../components/dashboard/UpcomingAlertsList";
import { EmailVerificationBanner } from "../components/common/EmailVerificationBanner";

import type { Job } from "../types/job";
import type { Alert } from "../types/alert";
import type { JobStatusCounts } from "../types/analytics";

import { useCurrentUser } from "../store/userContext";
import { fetchJobs } from "../api/jobs";
import { fetchAlerts } from "../api/alerts";
import { fetchJobStatusCounts } from "../api/analytics";

export function Dashboard() {
  const { user } = useCurrentUser();

  // Table + pipeline data (still uses jobs endpoint)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Dashboard KPIs (uses analytics endpoint)
  const [jobStats, setJobStats] = useState<JobStatusCounts | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Upcoming alerts (soonest first). Non-blocking — failures just show empty.
  const [alerts, setAlerts] = useState<Alert[]>([]);

  /* ============================================================
     Fetch Jobs (for table + pipeline only)
  ============================================================ */
  useEffect(() => {
    fetchJobs(1, 10, "createdAt", "desc") // Fetch only what the UI needs
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
        setJobStats(res);
      })
      .finally(() => {
        setLoadingStats(false);
      });
  }, []);

  /* ============================================================
     Fetch Upcoming Alerts (soonest first)
  ============================================================ */
  useEffect(() => {
    fetchAlerts(1, 5, "scheduledAlert", "asc")
      .then((res) => setAlerts(res.items))
      .catch(() => {
        // Non-critical widget; leave the list empty on failure.
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
    <AppLayout>
      <PageScroll>
        <section
          className="
            mx-auto w-full max-w-7xl
            px-4 sm:px-6 lg:px-8
            py-8
          "
        >
          <div className="flex flex-col gap-10">
            {!user.emailVerified && <EmailVerificationBanner />}

            <DashboardHeader />

            {/* KPI Cards should now use analytics data, not full job list */}
            <JobStatsGrid stats={jobStats} isLoading={loadingStats}/>

            {/* Pipeline visualization still relies on actual jobs */}
            <PipelineVisualization stats={jobStats} isLoading={loadingStats}/>

            {/* Richer analytics (FEAT-7-UI) */}
            <AnalyticsInsights />

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
