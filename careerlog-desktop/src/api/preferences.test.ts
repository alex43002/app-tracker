import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPreferences, updatePreferences } from "./preferences";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stub(data: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async (..._args: unknown[]) => ({
    ok,
    status,
    json: async () => ({ success: ok, data, error: ok ? null : data }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function call(fetchMock: ReturnType<typeof stub>, i = 0) {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return { url, method: init?.method ?? "GET", body: init?.body };
}

describe("preferences api", () => {
  it("fetchPreferences GETs the endpoint", async () => {
    const fetchMock = stub({
      preferredCompanies: ["A"],
      hiddenCompanies: [],
      hiddenEmploymentTypes: [],
    });
    const prefs = await fetchPreferences();
    expect(prefs.preferredCompanies).toEqual(["A"]);
    const c = call(fetchMock);
    expect(c.method).toBe("GET");
    expect(c.url).toContain("/api/preferences/");
  });

  it("updatePreferences PUTs the patch", async () => {
    const fetchMock = stub({
      preferredCompanies: [],
      hiddenCompanies: ["BadCo"],
      hiddenEmploymentTypes: [],
    });
    await updatePreferences({ hiddenCompanies: ["BadCo"] });
    const c = call(fetchMock);
    expect(c.method).toBe("PUT");
    expect(c.url).toContain("/api/preferences/");
    expect(JSON.parse(c.body as string)).toEqual({
      hiddenCompanies: ["BadCo"],
    });
  });
});
