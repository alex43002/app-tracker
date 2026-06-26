/** A résumé attached to a job (FEAT-10). The bytes live in GridFS. */
export interface JobResume {
  id: string;
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
}

/** A single entry in a job's status timeline (FEAT-13). */
export interface JobStatusHistoryEntry {
  status: string;
  at: string;
}

export interface Job {
  id: string;
  userId: string;

  // External reference supplied by the user (e.g. a posting/req number). Distinct
  // from `id`, which is this record's own server-assigned identifier (see CLN-8).
  jobId?: string | null;
  url: string;

  jobTitle: string;
  company: string;

  salaryTarget: number;
  salaryRange?: string | null;

  status: string;
  resume: File | null;
  // Additional résumés beyond the legacy single `resume` (FEAT-10).
  resumes?: JobResume[];
  // Per-status timeline, newest last (FEAT-13).
  statusHistory?: JobStatusHistoryEntry[];
  location: string;
  employmentType: string;
  notes?: string | null;

  createdAt: string;
  updatedAt: string;
}
