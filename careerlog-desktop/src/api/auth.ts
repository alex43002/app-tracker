import { apiClient } from "./client";

/* ============================================================
   Auth Types
============================================================ */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "bearer";
  expiresIn: number;
}

export interface SignupRequest {
  email: string;
  password: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  pfp: string;
}


export interface SignupResponse {
  userId: string;
}

/* ============================================================
   Auth Calls
============================================================ */

export function login(request: LoginRequest) {
  return apiClient.post<LoginResponse>("/api/auth/login", request);
}

export function signup(request: SignupRequest) {
  return apiClient.post<SignupResponse>("/api/auth/register", request);
}
