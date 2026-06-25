import type { User } from "../types/user";
import { apiClient } from "./client";

export function fetchCurrentUser() {
  return apiClient.get<User>("/api/users/me");
}

/**
 * Upload a new profile picture (multipart). Returns the new GridFS id.
 */
export function uploadProfilePicture(userId: string, file: File) {
  const form = new FormData();
  form.append("pfp", file);
  return apiClient.put<{ pfp: string; updatedAt: string }>(
    `/api/users/${userId}/pfp`,
    form
  );
}

/**
 * Fetch a user's profile picture and return an object URL for it (or null).
 * The caller is responsible for revoking the URL when done.
 */
export async function fetchProfilePicture(
  userId: string
): Promise<string | null> {
  const token = localStorage.getItem("careerlog_token");

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/users/${userId}/pfp`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );

  if (!response.ok) return null;

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
