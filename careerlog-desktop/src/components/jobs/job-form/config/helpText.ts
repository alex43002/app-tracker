/**
 * Centralized help text for every Job form field.
 * This file is the single source of truth for tooltip content.
 *
 * Rules:
 * - Every field MUST have an entry here
 * - No JSX
 * - No UI logic
 * - Plain, explicit language
 */

export const HELP_TEXT = {
  company:
    "The legal or commonly used name of the company you applied to. Example: Google, Amazon, JPMorgan Chase.",

  jobTitle:
    "The exact job title listed on the posting. This helps keep applications consistent and searchable.",

  url:
    "A direct link to the job posting you applied to. Paste the full URL from the browser address bar.",

  jobId:
    "An optional internal or external job ID. This is sometimes provided by the employer or applicant tracking system.",

  location:
    "Where the job is based. Use a city and state (e.g., New York, NY) or specify Remote if applicable.",

  employmentType:
    "The type of employment for this role, such as full-time, part-time, contract, or internship.",

  salaryTarget:
    "Your desired base salary for this role. Enter a single annual number before bonuses or equity.",

  salaryRange:
    "Optional range listed by the employer. Example: $90,000 - $120,000. Leave blank if unknown.",

  resume:
    "The resume version used for this application. This helps track which resume performed best for different roles.",

  status:
    "The current stage of your application process, such as applied, interviewing, offer, or rejected.",
} as const;

export type HelpTextKey = keyof typeof HELP_TEXT;
