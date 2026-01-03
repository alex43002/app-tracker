import { apiClient } from "./client";

export interface User {
  id: string;
  email: string;
  fullName: string;
  pfp: string;
  createdAt: string;
}

export function fetchCurrentUser() {
  return apiClient.get<User>("/api/users/me");
}
