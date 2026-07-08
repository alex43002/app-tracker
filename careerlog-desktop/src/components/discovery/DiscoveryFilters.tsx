import {
  NO_LOCATION_FILTER,
  type DiscoveryFilters as Filters,
  type LocationFacet,
} from "../../types/discovery";

const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
  "temporary",
];
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead"];
const WORK_ARRANGEMENTS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

type Props = {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  locationFacets: LocationFacet[];
  noLocationCount: number;
};

/** The discovery filter grid (title, guided location, type/level/salary/…). */
export function DiscoveryFilters({
  filters,
  setFilter,
  locationFacets,
  noLocationCount,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-4">
      <input
        value={filters.q ?? ""}
        onChange={(e) => setFilter("q", e.target.value)}
        placeholder="Search title…"
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
      {/* Guided location filter (FEAT-30): suggest real locations and
          offer a "no location listed" option instead of free-form text. */}
      <div className="flex flex-col gap-1">
        <input
          list="location-facets"
          value={
            filters.location === NO_LOCATION_FILTER
              ? ""
              : (filters.location ?? "")
          }
          disabled={filters.location === NO_LOCATION_FILTER}
          onChange={(e) => setFilter("location", e.target.value || undefined)}
          placeholder="City, state, or region"
          className="rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
        />
        <datalist id="location-facets">
          {locationFacets.map((l) => (
            <option
              key={l.value}
              value={l.value}
              label={`${l.count} posting${l.count === 1 ? "" : "s"}`}
            />
          ))}
        </datalist>
        {noLocationCount > 0 && (
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={filters.location === NO_LOCATION_FILTER}
              onChange={(e) =>
                setFilter(
                  "location",
                  e.target.checked ? NO_LOCATION_FILTER : undefined,
                )
              }
            />
            No location listed ({noLocationCount})
          </label>
        )}
      </div>
      <select
        value={filters.workArrangement ?? ""}
        onChange={(e) => setFilter("workArrangement", e.target.value)}
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any location type</option>
        {WORK_ARRANGEMENTS.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label}
          </option>
        ))}
      </select>
      <select
        value={filters.employmentType ?? ""}
        onChange={(e) => setFilter("employmentType", e.target.value)}
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any type</option>
        {EMPLOYMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={filters.experienceLevel ?? ""}
        onChange={(e) => setFilter("experienceLevel", e.target.value)}
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any level</option>
        {EXPERIENCE_LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        step={10000}
        value={filters.salaryMin ?? ""}
        onChange={(e) =>
          setFilter(
            "salaryMin",
            e.target.value ? Number(e.target.value) : undefined,
          )
        }
        placeholder="Min salary"
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
      <select
        value={
          filters.requiresDegree === undefined
            ? ""
            : String(filters.requiresDegree)
        }
        onChange={(e) =>
          setFilter(
            "requiresDegree",
            e.target.value === "" ? undefined : e.target.value === "true",
          )
        }
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Degree: any</option>
        <option value="false">No degree required</option>
        <option value="true">Degree required</option>
      </select>
      <select
        value={filters.maxAgeDays ?? ""}
        onChange={(e) =>
          setFilter(
            "maxAgeDays",
            e.target.value ? Number(e.target.value) : undefined,
          )
        }
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any age</option>
        <option value="7">Past week</option>
        <option value="14">Past 2 weeks</option>
        <option value="30">Past month</option>
      </select>
      <select
        value={
          filters.sponsorshipAvailable === undefined
            ? ""
            : String(filters.sponsorshipAvailable)
        }
        onChange={(e) =>
          setFilter(
            "sponsorshipAvailable",
            e.target.value === "" ? undefined : e.target.value === "true",
          )
        }
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Sponsorship: any</option>
        <option value="true">Sponsors visa</option>
        <option value="false">No sponsorship</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={filters.minQuality === 60}
          onChange={(e) =>
            setFilter("minQuality", e.target.checked ? 60 : undefined)
          }
        />
        Hide low-quality
      </label>
    </div>
  );
}
