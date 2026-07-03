import type { StarStory, StarStoryInput } from "../types/starStory";
import { apiClient } from "./client";

/* ============================================================
   STAR story library (interview prep)
   Responses are already unwrapped by apiClient.
============================================================ */

export async function fetchStarStories(): Promise<StarStory[]> {
  const res = await apiClient.get<{ items: StarStory[] }>("/api/star-stories/");
  return res.items;
}

export function createStarStory(input: StarStoryInput) {
  return apiClient.post<StarStory>("/api/star-stories/", input);
}

export function updateStarStory(id: string, input: Partial<StarStoryInput>) {
  return apiClient.put<StarStory>(`/api/star-stories/${id}`, input);
}

export function deleteStarStory(id: string) {
  return apiClient.delete<void>(`/api/star-stories/${id}`);
}
