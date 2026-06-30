import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCompanyDirectory,
  fetchDiscoveredJobs,
  fetchDiscoverySources,
  ingestBoard,
  resolveBoardToken,
} from "./discovery";

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

describe("discovery api", () => {
  it("fetchDiscoverySources unwraps the sources array", async () => {
    const fetchMock = stub({ sources: ["greenhouse", "lever"] });
    const sources = await fetchDiscoverySources();
    expect(sources).toEqual(["greenhouse", "lever"]);
    expect(call(fetchMock).url).toContain("/api/discovery/sources");
  });

  it("ingestBoard POSTs the source + token", async () => {
    const fetchMock = stub({
      source: "greenhouse",
      company: "Acme",
      fetched: 5,
      inserted: 5,
      updated: 0,
    });
    const res = await ingestBoard("greenhouse", "acme", "Acme");
    expect(res.inserted).toBe(5);
    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/discovery/ingest");
    expect(JSON.parse(c.body as string)).toEqual({
      source: "greenhouse",
      boardToken: "acme",
      companyName: "Acme",
    });
  });

  it("resolveBoardToken POSTs the url and returns the resolved board", async () => {
    const fetchMock = stub({ source: "greenhouse", boardToken: "stripe" });
    const res = await resolveBoardToken("https://boards.greenhouse.io/stripe");
    expect(res).toEqual({ source: "greenhouse", boardToken: "stripe" });
    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/discovery/resolve");
    expect(JSON.parse(c.body as string)).toEqual({
      url: "https://boards.greenhouse.io/stripe",
    });
  });

  it("fetchCompanyDirectory unwraps companies and forwards the query", async () => {
    const fetchMock = stub({
      companies: [{ name: "Stripe", source: "greenhouse", boardToken: "stripe" }],
    });
    const out = await fetchCompanyDirectory("stri");
    expect(out).toEqual([
      { name: "Stripe", source: "greenhouse", boardToken: "stripe" },
    ]);
    expect(call(fetchMock).url).toContain("/api/discovery/companies?q=stri");
  });

  it("fetchDiscoveredJobs serializes only the set filters into the query", async () => {
    const fetchMock = stub({ items: [], meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } });
    await fetchDiscoveredJobs({
      q: "engineer",
      salaryMin: 100000,
      requiresDegree: false,
      location: "",
      company: undefined,
    });
    const { url } = call(fetchMock);
    expect(url).toContain("q=engineer");
    expect(url).toContain("salaryMin=100000");
    expect(url).toContain("requiresDegree=false");
    // Empty/undefined values are omitted.
    expect(url).not.toContain("location=");
    expect(url).not.toContain("company=");
  });
});
