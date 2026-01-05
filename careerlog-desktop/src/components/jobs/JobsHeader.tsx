interface JobsHeaderProps {
  onCreate: () => void;
}

export function JobsHeader({ onCreate }: JobsHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-gray-600">
          Track and manage your job applications
        </p>
      </div>

      <button
        onClick={onCreate}
        className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Add Job
      </button>
    </div>
  );
}
