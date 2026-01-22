// src/api/client.ts
//
// Centralized API client for CareerLog Desktop.
//
// Responsibilities:
// - Inject JWT bearer token when present
// - Support both JSON and multipart (FormData) requests
// - Normalize FastAPI response envelopes
// - Surface backend error messages verbatim
// - Provide reusable, typed helpers for all endpoints
//
// Design rule:
// The API response envelope is authoritative.
// If `success === false`, the backend message is shown verbatim.
// HTTP status codes are informational only.

import { clearAuthToken } from "../store/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/* ============================================================
   Auth Token Handling
============================================================ */

let authToken: string | null = null;

/**
 * Sets or clears the JWT used for authenticated requests.
 * Called at app bootstrap and on login/logout.
 */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/* ============================================================
   API Response Types
============================================================ */

/**
 * Structured error payload returned by the backend.
 */
export interface ApiErrorPayload {
  code: string;
  message: string;
}

/**
 * Standard API response envelope.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
}

/* ============================================================
   Pagination Types
============================================================ */

/**
 * Pagination metadata returned by list endpoints.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Standard paginated payload returned inside `data`.
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/* ============================================================
   API Error Class
============================================================ */

/**
 * Error thrown by the API client.
 * Carries both backend error code and HTTP status.
 */
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message);
    this.code = payload.code;
    this.status = status;
  }
}

/* ============================================================
   Core Request Function
============================================================ */

/**
 * Performs a request against the backend API.
 *
 * Behavior:
 * - Supports both JSON and FormData payloads
 * - Automatically sets Content-Type for JSON requests
 * - Allows the browser to manage multipart boundaries
 * - Always attempts to parse JSON responses
 * - Unwraps FastAPI `detail` responses when present
 * - Treats `success === false` as an API-level failure
 * - Surfaces backend-provided error messages verbatim
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
    const token = authToken ?? localStorage.getItem("careerlog_token");

    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });


  let raw: unknown;

  try {
    raw = await response.json();
  } catch {
    throw new ApiError(
      {
        code: "INVALID_RESPONSE",
        message: "Invalid server response",
      },
      response.status
    );
  }

  /*
    FastAPI may wrap error responses inside a `detail` field
    when raising HTTPException. If present, unwrap it so the
    rest of the client can rely on the standard envelope.
  */
  const json: ApiResponse<T> =
    typeof raw === "object" &&
    raw !== null &&
    "detail" in raw
      ? (raw as { detail: ApiResponse<T> }).detail
      : (raw as ApiResponse<T>);

  /*
    API-level failure.
    The backend has intentionally returned an error envelope.
    Surface the message exactly as provided.
  */
  if (json.success === false) {
    if (response.status === 401) {
        clearAuthToken();
        window.location.href = "/login";
    }
    
    throw new ApiError(
      json.error ?? {
        code: "UNKNOWN_ERROR",
        message: "Unknown API error",
      },
      response.status
    );
  }

  /*
    Successful response.
    At this point `data` is guaranteed by contract.
  */
  return json.data as T;
}

/* ============================================================
   Public API Client
============================================================ */

/**
 * Thin, typed wrapper around the core request function.
 *
 * Notes:
 * - JSON is the default request format
 * - FormData is passed through unchanged when provided
 * - No business logic belongs here
 */
export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body:
        body instanceof FormData
          ? body
          : body
          ? JSON.stringify(body)
          : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body:
        body instanceof FormData
          ? body
          : body
          ? JSON.stringify(body)
          : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
