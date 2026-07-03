import type { Offer, OfferInput } from "../types/offer";
import { apiClient } from "./client";

/* ============================================================
   Offer comparison tool
   Responses are already unwrapped by apiClient.
============================================================ */

export async function fetchOffers(): Promise<Offer[]> {
  const res = await apiClient.get<{ items: Offer[] }>("/api/offers/");
  return res.items;
}

export function createOffer(input: OfferInput) {
  return apiClient.post<Offer>("/api/offers/", input);
}

export function updateOffer(id: string, input: Partial<OfferInput>) {
  return apiClient.put<Offer>(`/api/offers/${id}`, input);
}

export function deleteOffer(id: string) {
  return apiClient.delete<void>(`/api/offers/${id}`);
}
