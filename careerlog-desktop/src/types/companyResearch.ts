/** A faceted value + how many postings have it. */
export interface Facet {
  value: string;
  count: number;
}

/** A company present in discovered postings, with its open-role count. */
export interface CompanyRef {
  name: string;
  openRoles: number;
}

/** A research snapshot derived from a company's public postings. */
export interface CompanySnapshot {
  company: string;
  found: boolean;
  openRoles: number;
  sources: string[];
  locations: Facet[];
  employmentTypes: Facet[];
  experienceLevels: Facet[];
  workArrangements: Facet[];
  topSkills: Facet[];
  sampleTitles: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  latestPostedAt: string | null;
}
