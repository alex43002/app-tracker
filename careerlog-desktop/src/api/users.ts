import type { User } from "../types/user";
import { apiClient } from "./client";

export function fetchCurrentUser() {
  return apiClient.get<User>("/api/users/me");
}

/** Editable core profile fields (FEAT-28). */
export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
}

/**
 * Update the current user's core account details (FEAT-28). Only the provided
 * fields change. Returns the new `updatedAt` and the resulting `emailVerified`
 * state (an email change resets verification server-side).
 */
export function updateUser(userId: string, payload: UpdateUserPayload) {
  return apiClient.put<{ updatedAt: string; emailVerified: boolean }>(
    `/api/users/${userId}`,
    payload,
  );
}

/** Remove the current user's profile picture (FEAT-28). */
export function deleteProfilePicture(userId: string) {
  return apiClient.delete<void>(`/api/users/${userId}/pfp`);
}

/**
 * Upload a new profile picture (multipart). Returns the new GridFS id.
 */
export function uploadProfilePicture(userId: string, file: File) {
  const form = new FormData();
  form.append("pfp", file);
  return apiClient.put<{ pfp: string; updatedAt: string }>(
    `/api/users/${userId}/pfp`,
    form,
  );
}

/**
 * Fetch a user's profile picture and return an object URL for it (or null).
 * The caller is responsible for revoking the URL when done.
 *
 * `version` (e.g. the current pfp id or `updatedAt`) is appended as a query
 * param so a freshly uploaded picture isn't masked by a cached response for the
 * otherwise-stable `/pfp` URL (BUG-14).
 */
export async function fetchProfilePicture(
  userId: string,
  version?: string | null,
): Promise<string | null> {
  const token = localStorage.getItem("careerlog_token");
  const query = version ? `?v=${encodeURIComponent(version)}` : "";

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/users/${userId}/pfp${query}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    },
  );

  if (!response.ok) return null;

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
