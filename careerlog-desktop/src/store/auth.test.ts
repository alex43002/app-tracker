import { beforeEach, describe, expect, it } from "vitest";
import { saveAuthToken, loadAuthToken, clearAuthToken } from "./auth";

const TOKEN_KEY = "careerlog_token";
const EXPIRY_KEY = "careerlog_token_expiry";

describe("auth store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the ISO expiresAt as epoch milliseconds (BUG-1 regression)", () => {
    const expiresAt = "2999-01-01T00:00:00.000Z";
    saveAuthToken("jwt-abc", expiresAt);

    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-abc");
    expect(localStorage.getItem(EXPIRY_KEY)).toBe(
      String(new Date(expiresAt).getTime())
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
    saveAuthToken("jwt", "2999-01-01T00:00:00.000Z");
    clearAuthToken();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(EXPIRY_KEY)).toBeNull();
  });
});
