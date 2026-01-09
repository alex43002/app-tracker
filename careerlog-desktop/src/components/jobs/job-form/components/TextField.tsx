import type { JobFormFieldKey } from "../config/formFields";
import { JobFormField } from "./JobFormField";

export function TextField({
  fieldKey,
  label,
  value,
  required,
  error,
  type = "text",
  onChange,
  onBlur,
}: {
  fieldKey: JobFormFieldKey;
  label: string;
  value: string;
  required?: boolean;
  error?: string;
  type?: "text" | "number" | "url";
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
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-200"
            : "focus:ring-black/20"
        }`}
      />
    </JobFormField>
  );
}
