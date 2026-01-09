import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";
import { HELP_TEXT } from "../config/helpText";
import type { JobFormFieldKey } from "../config/formFields";

/**
 * JobFormField
 *
 * Wraps an input with:
 * - Label
 * - Required indicator
 * - Tooltip (question mark)
 * - Error message
 *
 * This component guarantees that:
 * - Every field has help text
 * - Layout and behavior are consistent
 */
export function JobFormField({
  fieldKey,
  label,
  required,
  error,
  children,
}: {
  fieldKey: JobFormFieldKey;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const helpText = HELP_TEXT[fieldKey];

  return (
    <label className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-1">
        <span className="font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>

        <Tooltip content={helpText}>
          <span className="cursor-help text-gray-400 hover:text-gray-600">
            ?
          </span>
        </Tooltip>
      </div>

      {children}

      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </label>
  );
}
