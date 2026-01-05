interface JobsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function JobsPagination({
  page,
  pageSize,
  total,
  onChange,
}: JobsPaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <span>
        Page {page} of {totalPages}
      </span>

      <div className="flex gap-2">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="rounded-md border px-3 py-1 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-md border px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
