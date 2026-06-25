import { apiClient } from "./client";
import type { User } from "../types/user";

/* ============================================================
   Auth Types
============================================================ */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  pfp: string;
}

/**
 * Both /login and /register return the authenticated user plus an issued
 * session token. `expiresAt` is an ISO-8601 timestamp.
 */
export interface AuthSession {
  user: User;
  jwt: string;
  expiresAt: string;
}

/* ============================================================
   Auth Calls
============================================================ */

export function login(request: LoginRequest) {
  return apiClient.post<AuthSession>("/api/auth/login", request);
}

export function signup(request: SignupRequest) {
  return apiClient.post<AuthSession>("/api/auth/register", request);
}
