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
}

/** Access + refresh token bundle. `expiresAt` fields are ISO-8601 timestamps. */
export interface SessionTokens {
  jwt: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

/**
 * Both /login and /register return the authenticated user plus an issued
 * session (access + refresh tokens).
 */
export interface AuthSession extends SessionTokens {
  user: User;
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

export function refreshSession(refreshToken: string) {
  return apiClient.post<SessionTokens>("/api/auth/refresh", { refreshToken });
}

export function logout(refreshToken: string) {
  return apiClient.post<null>("/api/auth/logout", { refreshToken });
}
