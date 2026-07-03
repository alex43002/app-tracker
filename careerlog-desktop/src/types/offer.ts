/** A job offer captured for side-by-side comparison (offer comparison tool). */
export interface Offer {
  id: string;
  company: string;
  role: string;
  location: string;
  baseSalary: number | null;
  bonus: number | null;
  equityPerYear: number | null;
  signOnBonus: number | null;
  benefitsRating: number | null;
  flexibilityRating: number | null;
  fitRating: number | null;
  notes: string;
  status: string;
  totalComp: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfferInput {
  company: string;
  role: string;
  location?: string;
  baseSalary?: number | null;
  bonus?: number | null;
  equityPerYear?: number | null;
  signOnBonus?: number | null;
  benefitsRating?: number | null;
  flexibilityRating?: number | null;
  fitRating?: number | null;
  notes?: string;
  status?: string;
}

export const OFFER_STATUSES = [
  "received",
  "negotiating",
  "accepted",
  "declined",
  "expired",
] as const;
