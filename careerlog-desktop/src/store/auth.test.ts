import { beforeEach, describe, expect, it } from "vitest";
import {
  saveAuthToken,
  saveSession,
  getRefreshToken,
  loadAuthToken,
  clearAuthToken,
} from "./auth";

const TOKEN_KEY = "careerlog_token";
const EXPIRY_KEY = "careerlog_token_expiry";

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

describe("auth store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the ISO expiresAt as epoch milliseconds (BUG-1 regression)", () => {
    const expiresAt = "2999-01-01T00:00:00.000Z";
    saveAuthToken("jwt-abc", expiresAt);

    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-abc");
    expect(localStorage.getItem(EXPIRY_KEY)).toBe(
      String(new Date(expiresAt).getTime()),
    );
    // The old bug produced "NaN" here from a non-existent expiresIn.
    expect(localStorage.getItem(EXPIRY_KEY)).not.toBe("NaN");
  });

  it("loads a token that has not expired", () => {
    saveAuthToken("jwt-future", "2999-01-01T00:00:00.000Z");
    expect(loadAuthToken()).toBe("jwt-future");
  });

  it("clears and returns null for an expired token", () => {
    saveAuthToken("jwt-past", "2000-01-01T00:00:00.000Z");
    expect(loadAuthToken()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("returns null when no token is present", () => {
    expect(loadAuthToken()).toBeNull();
  });

  it("clearAuthToken removes persisted values", () => {
    saveAuthToken("jwt", FUTURE);
    clearAuthToken();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(EXPIRY_KEY)).toBeNull();
  });

  it("saveSession persists both tokens and getRefreshToken returns the valid one", () => {
    saveSession({
      jwt: "access-1",
      expiresAt: FUTURE,
      refreshToken: "refresh-1",
      refreshExpiresAt: FUTURE,
    });

    expect(loadAuthToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("getRefreshToken returns null for an expired refresh token", () => {
    saveSession({
      jwt: "access-2",
      expiresAt: FUTURE,
      refreshToken: "refresh-2",
      refreshExpiresAt: PAST,
    });

    expect(getRefreshToken()).toBeNull();
  });

  it("clearAuthToken also removes the refresh token", () => {
    saveSession({
      jwt: "a",
      expiresAt: FUTURE,
      refreshToken: "r",
      refreshExpiresAt: FUTURE,
    });
    clearAuthToken();
    expect(getRefreshToken()).toBeNull();
  });
});
