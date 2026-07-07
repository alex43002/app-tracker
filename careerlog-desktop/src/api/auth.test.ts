import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stubOk() {
  const fetchMock = vi.fn(async (..._args: unknown[]) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: null, error: null }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof stubOk>) {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("password reset api", () => {
  it("requestPasswordReset POSTs the email", async () => {
    const fetchMock = stubOk();
    await requestPasswordReset("a@example.com");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/password-reset/request");
    expect(init.method).toBe("POST");
    expect(bodyOf(fetchMock)).toEqual({ email: "a@example.com" });
  });

  it("confirmPasswordReset POSTs the token and new password", async () => {
    const fetchMock = stubOk();
    await confirmPasswordReset("tok", "new-pass-123");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/password-reset/confirm");
    expect(bodyOf(fetchMock)).toEqual({
      token: "tok",
      newPassword: "new-pass-123",
    });
  });
});

describe("email verification api", () => {
  it("requestEmailVerification POSTs the email", async () => {
    const fetchMock = stubOk();
    await requestEmailVerification("a@example.com");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/verify-email/request");
    expect(bodyOf(fetchMock)).toEqual({ email: "a@example.com" });
  });

  it("confirmEmailVerification POSTs the token", async () => {
    const fetchMock = stubOk();
    await confirmEmailVerification("tok");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/verify-email/confirm");
    expect(bodyOf(fetchMock)).toEqual({ token: "tok" });
  });
});
