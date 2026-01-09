import { JobFormField } from "./JobFormField";
import type { JobFormFieldKey } from "../config/formFields";

/**
 * ResumeField
 *
 * First-class field for resume tracking.
 *
 * NOTE:
 * - Currently uses a text input
 * - Intentionally isolated so it can evolve into a file upload
 *   without impacting the rest of the form
 */
export function ResumeField({
  fieldKey,
  label,
  value,
  required,
  error,
  onChange,
  onBlur,
}: {
  fieldKey: JobFormFieldKey;
  label: string;
  value: string;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <JobFormField
      fieldKey={fieldKey}
      label={label}
      required={required}
      error={error}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="e.g. Resume v3, SWE Resume, Backend Resume"
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-200"
            : "focus:ring-black/20"
        }`}
      />
    </JobFormField>
  );
}
