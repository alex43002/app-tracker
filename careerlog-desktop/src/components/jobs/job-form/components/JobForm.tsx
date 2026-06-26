import type { Job } from "../../../../types/job";
import type { JobFormErrors, JobFormSavePayload } from "../types";
import { forwardRef, useImperativeHandle } from "react";
import toast from "react-hot-toast";

import { ApiError } from "../../../../api/client";
import { JOB_FORM_FIELDS, JOB_FORM_SECTIONS } from "../config/formFields";
import { useJobForm } from "../hooks/useJobForm";
import { diffJobPayload } from "../utils/diffJobPayload";
import { normalizeJobPayload } from "../utils/normalizeJobPayload";

// Form fields the backend can return validation details for.
const FORM_FIELD_KEYS = new Set(JOB_FORM_FIELDS.map((f) => f.key));

/** Map an ApiError's `details` onto the form's field keys (FEAT-2 follow-up). */
function fieldErrorsFromApi(error: ApiError): JobFormErrors {
  const mapped: JobFormErrors = {};
  for (const detail of error.details ?? []) {
    // Backend field paths line up with form keys (e.g. "salaryTarget").
    const key = detail.field as keyof JobFormErrors;
    if (FORM_FIELD_KEYS.has(key as never)) {
      mapped[key] = detail.message;
    }
  }
  return mapped;
}

import { JobFormSection } from "./JobFormSection";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { SalaryField } from "./SalaryField";
import { ResumeField } from "./ResumeField";
import { JobResumeManager } from "./JobResumeManager";

export interface JobFormHandle {
  submit: () => void;
}

/**
 * JobForm
 *
 * Owns:
 * - Form rendering
 * - Field wiring
 * - Validation triggering
 * - Save payload preparation
 *
 * Does NOT:
 * - Handle modal lifecycle
 * - Handle animations
 */
export const JobForm = forwardRef<JobFormHandle, {
  job: Job | null;
  onSave: (payload: JobFormSavePayload) => void | Promise<void>;
}>(function JobForm({ job, onSave }, ref) {

  const {
    values,
    errors,
    touched,
    setFieldValue,
    setFieldTouched,
    touchAllFields,
    validateForm,
    setServerErrors,
  } = useJobForm({ job });

  async function handleSave() {
    const isValid = validateForm();
    if (!isValid) {
        touchAllFields();
        return;
    }

    const payload = job
      ? diffJobPayload(job, values)
      : normalizeJobPayload(values);

    try {
      await onSave(payload);
    } catch (err) {
      // Surface backend validation against the matching fields (FEAT-2
      // follow-up); fall back to a toast for non-field errors.
      if (err instanceof ApiError) {
        const fieldErrors = fieldErrorsFromApi(err);
        if (Object.keys(fieldErrors).length > 0) {
          setServerErrors(fieldErrors);
          return;
        }
      }
      toast.error(
        err instanceof ApiError ? err.displayMessage : "Failed to save job"
      );
    }
  }

  useImperativeHandle(ref, () => ({
    submit: handleSave,
  }));

  return (
    <div className="space-y-8">
      {(Object.keys(JOB_FORM_SECTIONS) as Array<
        keyof typeof JOB_FORM_SECTIONS
      >).map((sectionKey) => {
        const sectionTitle = JOB_FORM_SECTIONS[sectionKey];

        const fields = JOB_FORM_FIELDS.filter(
          (f) => f.section === sectionKey
        );

        return (
          <JobFormSection key={sectionKey} title={sectionTitle}>
            {fields.map((field) => {
              const commonProps = {
                fieldKey: field.key,
                label: field.label,
                required: field.required,
                error:
                  touched[field.key] ? errors[field.key] : undefined,
                onBlur: () => setFieldTouched(field.key),
              };

              switch (field.component) {
                case "text":
                  return (
                    <TextField
                      key={field.key}
                      {...commonProps}
                      value={String(values[field.key] ?? "")}
                      onChange={(v) => setFieldValue(field.key, v)}
                    />
                  );

                case "select":
                  return (
                    <SelectField
                      key={field.key}
                      {...commonProps}
                      value={String(values[field.key] ?? "")}
                      options={field.options ?? []}
                      onChange={(v) => setFieldValue(field.key, v)}
                    />
                  );

                case "salary":
                  return (
                    <SalaryField
                      key={field.key}
                      {...commonProps}
                      value={values.salaryTarget}
                      onChange={(v) =>
                        setFieldValue("salaryTarget", v)
                      }
                    />
                  );

                case "resume":
                  return (
                    <ResumeField
                      key={field.key}
                      {...commonProps}
                      value={values.resume}
                      onChange={(v) =>
                        setFieldValue("resume", v)
                      }
                    />
                  );

                default:
                  return null;
              }
            })}
          </JobFormSection>
        );
      })}

      {/* Multiple résumés (FEAT-10) — available once the job exists. */}
      {job && (
        <JobFormSection title="Résumés">
          <JobResumeManager jobId={job.id} />
        </JobFormSection>
      )}
    </div>
  );
});
