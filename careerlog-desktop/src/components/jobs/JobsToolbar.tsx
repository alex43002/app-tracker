export function JobsToolbar() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="text"
        placeholder="Search jobs…"
        className="w-full rounded-md border px-3 py-2 text-sm sm:max-w-xs"
      />

      <div className="flex gap-2">
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="applied">Applied</option>
          <option value="interviewing">Interviewing</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>

        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="createdAt">Newest</option>
          <option value="company">Company</option>
          <option value="jobTitle">Title</option>
        </select>
      </div>
    </div>
  );
}
