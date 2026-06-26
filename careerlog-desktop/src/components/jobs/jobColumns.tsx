import type { ReactNode } from "react";
import type { Job } from "../../types/job";
import { StatusBadge } from "./StatusBadge";

/**
 * Declarative column model for the Jobs table (FEAT-18). The table renders from
 * this list so columns can be reordered / hidden via a saved layout preference.
 * The "Actions" column is handled separately by the table (always last, always
 * shown) and is intentionally not part of this model.
 */
export interface JobColumn {
  key: string;
  label: string;
  cellClassName?: string;
  render: (job: Job) => ReactNode;
}

/** All data columns in their default order. */
export const JOB_COLUMNS: JobColumn[] = [
  {
    key: "company",
    label: "Company",
    cellClassName: "font-medium whitespace-nowrap",
    render: (job) => job.company,
  },
  {
    key: "title",
    label: "Title",
    render: (job) => (
      <div className="flex flex-col">
        <span className="whitespace-nowrap">{job.jobTitle}</span>
        {job.jobId && (
          <span className="text-xs text-gray-500">{job.jobId}</span>
        )}
      </div>
    ),
  },
  {
    key: "location",
    label: "Location",
    cellClassName: "whitespace-nowrap",
    render: (job) => job.location,
  },
  {
    key: "type",
    label: "Type",
    cellClassName: "capitalize whitespace-nowrap",
    render: (job) => job.employmentType.replace("-", " "),
  },
  {
    key: "status",
    label: "Status",
    cellClassName: "whitespace-nowrap",
    render: (job) => <StatusBadge status={job.status} />,
  },
  {
    key: "salary",
    label: "Salary",
    cellClassName: "whitespace-nowrap",
    render: (job) => (
      <div className="flex flex-col">
        <span>${job.salaryTarget.toLocaleString()}</span>
        {job.salaryRange && (
          <span className="text-xs text-gray-500">{job.salaryRange}</span>
        )}
      </div>
    ),
  },
  {
    key: "updated",
    label: "Updated",
    cellClassName: "text-gray-500 whitespace-nowrap",
    render: (job) => new Date(job.updatedAt).toLocaleDateString(),
  },
];
