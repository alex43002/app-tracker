/** Role-specific interview prep generated from a job description. */
export interface PrepTopic {
  name: string;
  kind: "skill" | "theme" | string;
}

export interface PrepResult {
  topics: PrepTopic[];
  technicalQuestions: string[];
  behavioralQuestions: string[];
  notes: string;
}
