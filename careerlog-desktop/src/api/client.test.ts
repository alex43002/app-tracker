import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "./client";
import { saveSession, getRefreshToken } from "../store/auth";

const FUTURE = "2999-01-01T00:00:00.000Z";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("apiClient", () => {
  it("unwraps the data field on success", async () => {
    mockFetch(200, { success: true, data: { id: "1" }, error: null });
    await expect(apiClient.get<{ id: string }>("/api/x")).resolves.toEqual({
      id: "1",
    });
  });

  it("throws ApiError carrying the backend code on failure", async () => {
    mockFetch(400, {
      success: false,
      data: null,
      error: { code: "VALIDATION_ERROR", message: "bad" },
    });

    await expect(apiClient.get("/api/x")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    await expect(apiClient.get("/api/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("exposes field-level validation details via displayMessage (FEAT-2)", async () => {
    mockFetch(422, {
      success: false,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: [
          { field: "email", message: "value is not a valid email address" },
          {
            field: "password",
            message: "String should have at least 8 characters",
          },
        ],
      },
    });

    const err = (await apiClient.get("/api/x").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.details).toHaveLength(2);
    expect(err.displayMessage).toContain("email:");
    expect(err.displayMessage).toContain("password:");
  });

  it("unwraps FastAPI detail-wrapped envelopes", async () => {
    mockFetch(404, {
      detail: {
        success: false,
        data: null,
        error: { code: "RESOURCE_NOT_FOUND", message: "missing" },
      },
    });

    await expect(apiClient.get("/api/x")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("silently refreshes on 401 and retries the original request (SEC-4)", async () => {
    saveSession({
      jwt: "expired-access",
      expiresAt: FUTURE,
      refreshToken: "valid-refresh",
      refreshExpiresAt: FUTURE,
    });

    const unauthorized = {
      success: false,
      data: null,
      error: { code: "AUTH_TOKEN_INVALID", message: "expired" },
    };
    const refreshed = {
      success: true,
      data: {
        jwt: "new-access",
        expiresAt: FUTURE,
        refreshToken: "new-refresh",
        refreshExpiresAt: FUTURE,
      },
      error: null,
    };
    const ok = { success: true, data: { ok: true }, error: null };

    const fetchMock = vi
      .fn()
      // 1) original protected request -> 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => unauthorized,
      })
      // 2) POST /api/auth/refresh -> new session
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => refreshed,
      })
      // 3) retried protected request -> success
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ok });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.get("/api/jobs")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/refresh");
    // The rotated refresh token was persisted.
    expect(getRefreshToken()).toBe("new-refresh");
  });
});
