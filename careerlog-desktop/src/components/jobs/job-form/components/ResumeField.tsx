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
  value: File | null;
  required?: boolean;
  error?: string;
  onChange: (file: File | null) => void;
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
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          console.log(file);
          onChange(file);
        }}
        onBlur={onBlur}
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-200"
            : "focus:ring-black/20"
        }`}
      />

      {value && (
        <p className="mt-1 text-xs text-gray-600">
          Selected: {value.name}
        </p>
      )}
    </JobFormField>
  );
}
