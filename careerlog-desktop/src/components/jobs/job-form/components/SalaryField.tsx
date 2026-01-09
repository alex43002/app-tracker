import { JobFormField } from "./JobFormField";
import type { JobFormFieldKey } from "../config/formFields";

/**
 * SalaryField
 *
 * Specialized numeric input for salary.
 * Improves UX over a raw number input:
 * - Prevents negative values
 * - Allows empty input without coercing to 0
 */
export function SalaryField({
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
  value: number;
  required?: boolean;
  error?: string;
  onChange: (value: number) => void;
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
        type="number"
        min={0}
        step={1000}
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
          } else {
            onChange(Number(raw));
          }
        }}
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
