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
import { fetchCurrentUser } from "../api/users";

/* TEMP: mocked API-shaped data */
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

const alerts: Alert[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `${i}`,
  scheduledAlert: new Date(Date.now() + i * 86400000).toISOString(),
  smsOrEmail: i % 2 === 0 ? "email" : "sms",
  message: "Follow up with recruiter",
}));

export function Dashboard() {
  const [user, setUser] = useState<{
    fullName: string;
    pfp?: string | null;
  } | null>(null);

  useEffect(() => {
    // fetchCurrentUser().then((u) => {
    //   setUser({
    //     fullName: u.fullName,
    //     pfp: u.pfp,
    //   });
    // });
  }, []);

  if (!user) {
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
