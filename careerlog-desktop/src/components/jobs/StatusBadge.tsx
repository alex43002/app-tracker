/** Colored pill for a job's status. Shared by the Jobs table and its columns. */
export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "offer"
      ? "bg-green-100 text-green-800"
      : status === "interviewing"
        ? "bg-blue-100 text-blue-800"
        : status === "rejected"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-800";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}
