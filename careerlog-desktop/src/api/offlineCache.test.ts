import { afterEach, describe, expect, it } from "vitest";
import {
  clearOfflineCache,
  readCache,
  withOfflineCache,
  writeCache,
} from "./offlineCache";

afterEach(() => {
  localStorage.clear();
});

describe("offline cache (FEAT-9)", () => {
  it("round-trips a value through localStorage", () => {
    writeCache("k", { a: 1 });
    expect(readCache<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("returns fresh data and caches it on success", async () => {
    const result = await withOfflineCache("jobs", async () => ({ items: [1] }));
    expect(result).toEqual({ data: { items: [1] }, stale: false });
    expect(readCache("jobs")).toEqual({ items: [1] });
  });

  it("falls back to cached data (stale) when the fetch fails", async () => {
    writeCache("jobs", { items: [42] });
    const result = await withOfflineCache<{ items: number[] }>("jobs", () => {
      throw new Error("offline");
    });
    expect(result).toEqual({ data: { items: [42] }, stale: true });
  });

  it("rethrows when the fetch fails and nothing is cached", async () => {
    await expect(
      withOfflineCache("missing", () => Promise.reject(new Error("offline")))
    ).rejects.toThrow("offline");
  });

  it("clearOfflineCache removes only cache-prefixed keys", () => {
    writeCache("jobs", { items: [] });
    localStorage.setItem("careerlog_token", "keep-me");
    clearOfflineCache();
    expect(readCache("jobs")).toBeNull();
    expect(localStorage.getItem("careerlog_token")).toBe("keep-me");
  });
});
