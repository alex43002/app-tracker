import type { ReactNode } from "react";

/**
 * JobFormSection
 *
 * Pure layout component for grouping fields.
 * No logic, no state, no form awareness.
 */
export function JobFormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold text-gray-700">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}
