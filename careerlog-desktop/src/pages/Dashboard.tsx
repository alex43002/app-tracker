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

import { fetchCurrentUser } from "../api/users";
import { fetchJobs } from "../api/jobs";

/* TEMP: alerts still mocked */
const alerts: Alert[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `${i}`,
  scheduledAlert: new Date(Date.now() + i * 86400000).toISOString(),
  smsOrEmail: i % 2 === 0 ? "email" : "sms",
  message: "Follow up with recruiter",
}));

export function Dashboard() {
  const [user, setUser] = useState<User>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      setUser(u);
    });
  }, []);

  useEffect(() => {
    fetchJobs(1, 10)
      .then((res) => {
        console.log(res)
        setJobs(res.items);
      })
      .finally(() => {
        setLoadingJobs(false);
      });
  }, []);

  if (!user || loadingJobs) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-gray-500">
          Loading dashboard…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <PageScroll>
        <div className="flex flex-col gap-8">
          <DashboardHeader />

          <JobStatsGrid jobs={jobs} />
          <PipelineVisualization jobs={jobs} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecentJobsTable jobs={jobs} />
            <UpcomingAlertsList alerts={alerts} />
          </div>
        </div>
      </PageScroll>
    </AppLayout>
  );
}
