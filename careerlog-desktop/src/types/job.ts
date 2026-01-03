export interface Job {
  id: string;
  userId: string;

  jobId?: string | null;
  url: string;

  jobTitle: string;
  company: string;

  salaryTarget: number;
  salaryRange?: string | null;

  status: string;
  resume: string;
  location: string;
  employmentType: string;

  createdAt: string;
  updatedAt: string;
}
