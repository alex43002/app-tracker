import { JobCard } from "./JobCard";
import type { DiscoveredJob } from "../../types/discovery";

type Props = {
  loading: boolean;
  totalItems: number;
  totalPages: number;
  page: number;
  jobs: DiscoveredJob[];
  displayedJobs: DiscoveredJob[];
  sortByFit: boolean;
  fitById: Record<string, number>;
  onHideCompany?: (company: string) => void;
  onPageChange: (page: number) => void;
};

/** Results header, the postings list (empty state), and pagination. */
export function DiscoveryResults({
  loading,
  totalItems,
  totalPages,
  page,
  jobs,
  displayedJobs,
  sortByFit,
  fitById,
  onHideCompany,
  onPageChange,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{loading ? "Loading…" : `${totalItems} listings`}</span>
        <span>
          Page {page} of {Math.max(totalPages, 1)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {!loading && jobs.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No postings match. Import a company board above, or relax your
            filters.
          </div>
        ) : (
          displayedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              fit={sortByFit ? fitById[job.id] : undefined}
              onHideCompany={onHideCompany}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pb-4">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
