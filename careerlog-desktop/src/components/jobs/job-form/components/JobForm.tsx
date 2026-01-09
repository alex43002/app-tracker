import type { Job } from "../../../../types/job";
import type { JobFormSavePayload } from "../types";

import { JOB_FORM_FIELDS, JOB_FORM_SECTIONS } from "../config/formFields";
import { useJobForm } from "../hooks/useJobForm";
import { diffJobPayload } from "../utils/diffJobPayload";
import { normalizeJobPayload } from "../utils/normalizeJobPayload";

import { JobFormSection } from "./JobFormSection";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { SalaryField } from "./SalaryField";
import { ResumeField } from "./ResumeField";

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
export function JobForm({
  job,
  onSave,
}: {
  job: Job | null;
  onSave: (payload: JobFormSavePayload) => void;
}) {
  const {
    values,
    errors,
    touched,
    setFieldValue,
    setFieldTouched,
    touchAllFields,
    validateForm,
  } = useJobForm({ job });

  function handleSave() {
    const isValid = validateForm();
    if (!isValid) {
        touchAllFields();
        return;
    }

    if (job) {
      onSave(diffJobPayload(job, values));
    } else {
      onSave(normalizeJobPayload(values));
    }
  }

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
                      value={(values as any)[field.key] ?? ""}
                      onChange={(v) =>
                        setFieldValue(field.key as any, v)
                      }
                    />
                  );

                case "select":
                  return (
                    <SelectField
                      key={field.key}
                      {...commonProps}
                      value={(values as any)[field.key]}
                      options={field.options ?? []}
                      onChange={(v) =>
                        setFieldValue(field.key as any, v)
                      }
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

      {/* Save button is intentionally owned by the parent modal */}
      <div className="hidden" data-save-handler>
        <button onClick={handleSave} />
      </div>
    </div>
  );
}
