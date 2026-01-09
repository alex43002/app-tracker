import type { CreateJobPayload } from "../../../../api/jobs";
import type { JobFormValues } from "../types";

/**
 * Normalizes form values into a CreateJobPayload.
 *
 * Purpose:
 * - Enforce consistent payload shape
 * - Sanitize optional / nullable fields
 * - Centralize any future transformations
 *
 * This function should be used for CREATE only.
 */
export function normalizeJobPayload(
  values: JobFormValues
): CreateJobPayload {
  return {
    jobId: values.jobId ?? null,
    url: values.url.trim(),
    jobTitle: values.jobTitle.trim(),
    company: values.company.trim(),
    salaryTarget: values.salaryTarget,
    salaryRange: values.salaryRange?.trim() || null,
    status: values.status,
    resume: values.resume,
    location: values.location.trim(),
    employmentType: values.employmentType,
  };
}
