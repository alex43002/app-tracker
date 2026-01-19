import type { CreateJobPayload, UpdateJobPayload } from "../../../api/jobs";
import type { Job } from "../../../types/job";
import type { JobFormFieldKey } from "./config/formFields";

/**
 * Internal form value type.
 *
 */
export interface JobFormValues {
  jobId: string | null;
  url: string;
  jobTitle: string;
  company: string;
  salaryTarget: number;
  salaryRange: string | null;
  status: string;
  resume: File | null;
  location: string;
  employmentType: string;
}

/**
 * Field-level error map.
 * Keys align strictly with form fields.
 */
export type JobFormErrors = Partial<Record<JobFormFieldKey, string>>;

/**
 * Hook return contract for the Job form.
 * Keeps UI components decoupled from implementation details.
 */
export interface UseJobFormResult {
  values: JobFormValues;
  errors: JobFormErrors;
  touched: Partial<Record<JobFormFieldKey, boolean>>;

  setFieldValue: <K extends JobFormFieldKey>(
    key: K,
    value: JobFormValues[K]
  ) => void;

  setFieldTouched: (key: JobFormFieldKey) => void;

  touchAllFields: () => void;
  
  validateForm: () => boolean;
  resetForm: () => void;
}

/**
 * Helper types for save behavior.
 */
export type JobFormSavePayload =
  | CreateJobPayload
  | UpdateJobPayload;

/**
 * Explicit mapping helper for edit mode.
 */
export interface JobFormInitOptions {
  job: Job | null;
}
