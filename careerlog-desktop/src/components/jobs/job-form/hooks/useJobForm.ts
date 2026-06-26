import { useCallback, useState } from "react";
import {
  VALIDATION_RULES,
} from "../config/validationRules";
import type { Job } from "../../../../types/job";
import type {
  JobFormErrors,
  JobFormInitOptions,
  JobFormValues,
  UseJobFormResult,
} from "../types";

/**
 * Canonical empty form state.
 * This is intentionally colocated with the hook (not UI).
 */
const EMPTY_VALUES: JobFormValues = {
  jobId: null,
  url: "",
  jobTitle: "",
  company: "",
  salaryTarget: 0,
  salaryRange: null,
  status: "applied",
  resume: null,
  location: "",
  employmentType: "full-time",
  notes: null,
};

/** Build initial form values from a job (or the empty defaults). */
function valuesFromJob(job: Job | null): JobFormValues {
  if (!job) return EMPTY_VALUES;
  return {
    jobId: job.jobId ?? null,
    url: job.url,
    jobTitle: job.jobTitle,
    company: job.company,
    salaryTarget: job.salaryTarget,
    salaryRange: job.salaryRange ?? null,
    status: job.status,
    resume: job.resume ?? null,
    location: job.location,
    employmentType: job.employmentType,
    notes: job.notes ?? null,
  };
}

/**
 * useJobForm
 *
 * Owns:
 * - Form state
 * - Prefill logic
 * - Field-level updates
 * - Validation execution
 *
 * Does NOT:
 * - Render UI
 * - Know about animations
 * - Know about modal lifecycle
 */
export function useJobForm(
  options: JobFormInitOptions
): UseJobFormResult {
  const { job } = options;

  // Initialize directly from the job prop. The form is remounted (keyed on the
  // job id) when the edited job changes, so there's no prefill effect to sync
  // state to props — initial state derives from the prop on mount.
  const [values, setValues] =
    useState<JobFormValues>(() => valuesFromJob(job));
  const [errors, setErrors] =
    useState<JobFormErrors>({});
  const [touched, setTouched] =
    useState<UseJobFormResult["touched"]>({});

  /* ============================
     Field Setters
  ============================ */

  const setFieldValue = useCallback(
    <K extends keyof JobFormValues>(
      key: K,
      value: JobFormValues[K]
    ) => {
      setValues((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const setFieldTouched = useCallback((key: keyof JobFormValues) => {
    setTouched((prev) => ({
      ...prev,
      [key]: true,
    }));
  }, []);

  const touchAllFields = useCallback(() => {
    const allTouched: typeof touched = {};

    (Object.keys(values) as Array<keyof typeof values>).forEach(
        (key) => {
        allTouched[key] = true;
        }
    );

    setTouched(allTouched);
  }, [values]);


  /* ============================
     Validation
  ============================ */

  const validateForm = useCallback((): boolean => {
    const nextErrors: JobFormErrors = {};

    (Object.keys(VALIDATION_RULES) as (keyof JobFormValues)[]).forEach(
      (key) => {
        const rule = VALIDATION_RULES[key];
        if (!rule) return;

        const error = rule(values[key]);
        if (error) {
          nextErrors[key] = error;
        }
      }
    );

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [values]);

  /* ============================
     Server-side field errors (FEAT-2 follow-up)
  ============================ */

  const setServerErrors = useCallback((serverErrors: JobFormErrors) => {
    const keys = Object.keys(serverErrors) as (keyof JobFormErrors)[];
    if (keys.length === 0) return;

    setErrors((prev) => ({ ...prev, ...serverErrors }));
    // Mark the affected fields touched so their messages render immediately.
    setTouched((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = true;
      });
      return next;
    });
  }, []);

  /* ============================
     Reset
  ============================ */

  const resetForm = useCallback(() => {
    setValues(EMPTY_VALUES);
    setErrors({});
    setTouched({});
  }, []);

  return {
    values,
    errors,
    touched,
    setFieldValue,
    setFieldTouched,
    touchAllFields,
    validateForm,
    setServerErrors,
    resetForm,
  };
}
