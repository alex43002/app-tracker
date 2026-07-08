import type { ReactNode } from "react";
import type { Job } from "../../types/job";
import { StatusBadge } from "./StatusBadge";

/**
 * Declarative column model for the Jobs table (FEAT-18). The table renders from
 * this list so every column can be reordered or hidden via a saved layout
 * preference — including the special "Actions" column (no `render`; the table
 * supplies the Edit/Delete buttons). `defaultVisible: false` keeps the less
 * common fields available but off by default so the grid stays compact.
 */
export interface JobColumn {
  key: string;
  label: string;
  cellClassName?: string;
  headerClassName?: string;
  /** Defaults to true when omitted. */
  defaultVisible?: boolean;
  /** Renders the data cell. Omitted for the special "actions" column. */
  render?: (job: Job) => ReactNode;
}

export const ACTIONS_COLUMN_KEY = "actions";

/** Data columns (everything except the special Actions column). */
const JOB_COLUMNS: JobColumn[] = [
  {
    key: "company",
    label: "Company",
    cellClassName: "font-medium whitespace-nowrap",
    render: (job) => job.company,
  },
  {
    key: "title",
    label: "Title",
    cellClassName: "whitespace-nowrap",
    render: (job) => job.jobTitle,
  },
  {
    key: "jobId",
    label: "Job ID",
    cellClassName: "whitespace-nowrap text-gray-500",
    defaultVisible: false,
    render: (job) => job.jobId || "—",
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
    key: "url",
    label: "Link",
    cellClassName: "max-w-[220px] truncate",
    defaultVisible: false,
    render: (job) =>
      job.url ? (
        <span className="text-blue-600" title={job.url}>
          {job.url}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "notes",
    label: "Notes",
    cellClassName: "max-w-[280px] truncate text-gray-600",
    defaultVisible: false,
    render: (job) =>
      job.notes ? <span title={job.notes}>{job.notes}</span> : "—",
  },
  {
    key: "created",
    label: "Created",
    cellClassName: "text-gray-500 whitespace-nowrap",
    defaultVisible: false,
    render: (job) => new Date(job.createdAt).toLocaleDateString(),
  },
  {
    key: "updated",
    label: "Updated",
    cellClassName: "text-gray-500 whitespace-nowrap",
    render: (job) => new Date(job.updatedAt).toLocaleDateString(),
  },
];

/** Full ordered universe of toggleable columns, including Actions (last). */
export const ALL_COLUMNS: JobColumn[] = [
  ...JOB_COLUMNS,
  {
    key: ACTIONS_COLUMN_KEY,
    label: "Actions",
    cellClassName: "text-right whitespace-nowrap",
    headerClassName: "text-right",
  },
];
