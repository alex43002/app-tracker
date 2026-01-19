import type { JobFormFieldKey } from "./formFields";

/**
 * Validation rule definition for a single field.
 * Return a string to indicate an error, or null if valid.
 */
export type ValidationRule<T = any> = (value: T) => string | null;

/**
 * Centralized validation rules for the Job form.
 *
 * Rules:
 * - Declarative
 * - Field-scoped
 * - No UI logic
 * - No side effects
 */
export const VALIDATION_RULES: Partial<
  Record<JobFormFieldKey, ValidationRule>
> = {
  company: (value: string) =>
    !value || !value.trim() ? "Company is required" : null,

  jobTitle: (value: string) =>
    !value || !value.trim() ? "Job title is required" : null,

  url: (value: string) =>
    !value || !value.trim() ? "Job URL is required" : null,

  location: (value: string) =>
    !value || !value.trim() ? "Location is required" : null,

  salaryTarget: (value: number) =>
    typeof value !== "number" || value <= 0
      ? "Salary target must be greater than 0"
      : null,

  resume: (value: File | null) =>
    value ? null : "Resume is required",
};
