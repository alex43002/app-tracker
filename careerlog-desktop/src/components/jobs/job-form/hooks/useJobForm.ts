import { useCallback, useEffect, useState } from "react";
import {
  VALIDATION_RULES,
} from "../config/validationRules";
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
  resume: "",
  location: "",
  employmentType: "full-time",
};

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

  const [values, setValues] =
    useState<JobFormValues>(EMPTY_VALUES);
  const [errors, setErrors] =
    useState<JobFormErrors>({});
  const [touched, setTouched] =
    useState<UseJobFormResult["touched"]>({});

  /* ============================
     Prefill / Reset
  ============================ */

  useEffect(() => {
    if (job) {
      setValues({
        jobId: job.jobId ?? null,
        url: job.url,
        jobTitle: job.jobTitle,
        company: job.company,
        salaryTarget: job.salaryTarget,
        salaryRange: job.salaryRange ?? null,
        status: job.status,
        resume: job.resume,
        location: job.location,
        employmentType: job.employmentType,
      });
    } else {
      setValues(EMPTY_VALUES);
    }

    setErrors({});
    setTouched({});
  }, [job]);

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
    resetForm,
  };
}
