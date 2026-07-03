/** A tracked job the email may refer to. */
export interface EmailMatchedJob {
  id: string;
  jobTitle: string;
  company: string;
  status: string;
}

/** Result of classifying a recruiting email (email-based application tracking). */
export interface EmailClassification {
  category:
    | "offer"
    | "rejection"
    | "interview"
    | "application_received"
    | "recruiter"
    | "other"
    | string;
  suggestedStatus: string | null;
  signals: string[];
  confidence: "low" | "medium" | "high" | string;
  matchedJobs: EmailMatchedJob[];
}
