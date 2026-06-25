import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "./client";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status,
      json: async () => body,
    }))
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
});
