import type { JobFormFieldKey } from "./formFields";

/**
 * Validation rule definition for a single field.
 * Return a string to indicate an error, or null if valid.
 */
export type ValidationRule<T = unknown> = (value: T) => string | null;

/**
 * Centralized validation rules for the Job form.
 *
 * Rules:
 * - Declarative
 * - Field-scoped
 * - No UI logic
 * - No side effects
 */
const requiredText = (label: string): ValidationRule => (value) =>
  typeof value === "string" && value.trim() ? null : `${label} is required`;

export const VALIDATION_RULES: Partial<
  Record<JobFormFieldKey, ValidationRule>
> = {
  company: requiredText("Company"),
  jobTitle: requiredText("Job title"),
  url: requiredText("Job URL"),
  location: requiredText("Location"),

  salaryTarget: (value) =>
    typeof value === "number" && value > 0
      ? null
      : "Salary target must be greater than 0",

  resume: (value) => (value ? null : "Resume is required"),
};
