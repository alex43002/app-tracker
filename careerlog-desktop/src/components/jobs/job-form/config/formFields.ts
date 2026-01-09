/**
 * Declarative definition of all Job form fields.
 *
 * This file defines:
 * - Field order
 * - Section grouping
 * - Labels
 * - Required flags
 * - Which UI component renders the field
 *
 * No UI logic belongs here.
 */

export type JobFormFieldKey =
  | "company"
  | "jobTitle"
  | "url"
  | "jobId"
  | "location"
  | "employmentType"
  | "salaryTarget"
  | "salaryRange"
  | "resume"
  | "status";

export type JobFormSectionKey =
  | "jobInfo"
  | "compensation"
  | "applicationDetails";

export interface JobFormFieldConfig {
  key: JobFormFieldKey;
  label: string;
  required?: boolean;
  section: JobFormSectionKey;
  component:
    | "text"
    | "number"
    | "select"
    | "salary"
    | "resume";
  options?: { value: string; label: string }[];
}

export const JOB_FORM_SECTIONS: Record<JobFormSectionKey, string> = {
  jobInfo: "Job Information",
  compensation: "Compensation",
  applicationDetails: "Application Details",
};

export const JOB_FORM_FIELDS: JobFormFieldConfig[] = [
  {
    key: "company",
    label: "Company",
    required: true,
    section: "jobInfo",
    component: "text",
  },
  {
    key: "jobTitle",
    label: "Job Title",
    required: true,
    section: "jobInfo",
    component: "text",
  },
  {
    key: "url",
    label: "Job URL",
    required: true,
    section: "jobInfo",
    component: "text",
  },
  {
    key: "jobId",
    label: "Internal Job ID",
    section: "jobInfo",
    component: "text",
  },
  {
    key: "location",
    label: "Location",
    required: true,
    section: "jobInfo",
    component: "text",
  },
  {
    key: "employmentType",
    label: "Employment Type",
    section: "jobInfo",
    component: "select",
    options: [
      { value: "full-time", label: "Full-time" },
      { value: "part-time", label: "Part-time" },
      { value: "contract", label: "Contract" },
      { value: "internship", label: "Internship" },
    ],
  },
  {
    key: "salaryTarget",
    label: "Salary Target",
    required: true,
    section: "compensation",
    component: "salary",
  },
  {
    key: "salaryRange",
    label: "Salary Range",
    section: "compensation",
    component: "text",
  },
  {
    key: "resume",
    label: "Resume Used",
    required: true,
    section: "applicationDetails",
    component: "resume",
  },
  {
    key: "status",
    label: "Status",
    section: "applicationDetails",
    component: "select",
    options: [
      { value: "applied", label: "Applied" },
      { value: "interviewing", label: "Interviewing" },
      { value: "offer", label: "Offer" },
      { value: "rejected", label: "Rejected" },
    ],
  },
];
