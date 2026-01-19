import type { Job } from "../../../../types/job";
import type { UpdateJobPayload } from "../../../../api/jobs";
import type { JobFormValues } from "../types";

/**
 * Produces a minimal UpdateJobPayload by diffing
 * form values against the original Job.
 *
 * Rules:
 * - Only changed fields are included
 * - null is never written to UpdateJobPayload
 * - Pure function (no side effects)
 * - Resume handled explicitly (future-safe)
 */
export function diffJobPayload(
  original: Job,
  values: JobFormValues
): UpdateJobPayload {
  const payload: UpdateJobPayload = {};

  (Object.keys(values) as (keyof JobFormValues)[]).forEach((key) => {
    const originalValue = (original as any)[key];
    const nextValue = values[key];

    // ---- Resume (explicit handling) ----
    if (key === "resume") {
      if (nextValue instanceof File) {
        payload.resume = nextValue;
      }
      return;
    }

    // ---- Generic fields ----
    if (nextValue !== originalValue) {
      // Never propagate null into UpdateJobPayload
      if (nextValue === null) return;

      (payload as any)[key] = nextValue;
    }
  });

  return payload;
}
