import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchApplicationsOverTime,
  fetchCompanyFunnels,
  fetchFunnel,
  fetchTimeToOffer,
} from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stubData(data: unknown) {
  const fetchMock = vi.fn(async (..._args: unknown[]) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, error: null }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function calledWith(fetchMock: ReturnType<typeof stubData>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, method: init?.method ?? "GET" };
}

describe("richer analytics api", () => {
  it("fetchFunnel GETs the funnel endpoint and unwraps data", async () => {
    const fetchMock = stubData({
      applied: 1,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      total: 1,
      responseRate: 0,
      interviewRate: 0,
      offerRate: 0,
    });
    const res = await fetchFunnel();
    expect(res.total).toBe(1);
    expect(calledWith(fetchMock).url).toContain("/api/analytics/funnel");
  });

  it("fetchApplicationsOverTime GETs the over-time endpoint", async () => {
    const fetchMock = stubData({ interval: "month", points: [] });
    const res = await fetchApplicationsOverTime();
    expect(res.interval).toBe("month");
    expect(calledWith(fetchMock).url).toContain(
      "/api/analytics/applications-over-time"
    );
  });

  it("fetchTimeToOffer GETs the time-to-offer endpoint", async () => {
    const fetchMock = stubData({ offers: 0, averageDays: null, medianDays: null });
    const res = await fetchTimeToOffer();
    expect(res.offers).toBe(0);
    expect(res.averageDays).toBeNull();
    expect(calledWith(fetchMock).url).toContain("/api/analytics/time-to-offer");
  });

  it("fetchCompanyFunnels GETs the by-company endpoint", async () => {
    const fetchMock = stubData({ companies: [] });
    const res = await fetchCompanyFunnels();
    expect(res.companies).toEqual([]);
    expect(calledWith(fetchMock).url).toContain("/api/analytics/by-company");
  });
});
