import type { User } from "../types/user";
import { apiClient } from "./client";

export function fetchCurrentUser() {
  return apiClient.get<User>("/api/users/me");
}
