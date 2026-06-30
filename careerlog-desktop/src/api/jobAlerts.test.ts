import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkJobAlert,
  createJobAlert,
  deleteJobAlert,
  fetchJobAlerts,
} from "./jobAlerts";

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

describe("job alerts api", () => {
  it("fetchJobAlerts unwraps the items array", async () => {
    const fetchMock = stub({ items: [{ id: "1", name: "A" }] });
    const items = await fetchJobAlerts();
    expect(items).toHaveLength(1);
    expect(call(fetchMock).url).toContain("/api/job-alerts/");
  });

  it("createJobAlert POSTs name + criteria + notify", async () => {
    const fetchMock = stub({ id: "9", name: "Remote" });
    await createJobAlert("Remote", { location: "Remote", salaryMin: 100000 });
    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(JSON.parse(c.body as string)).toEqual({
      name: "Remote",
      criteria: { location: "Remote", salaryMin: 100000 },
      notify: true,
    });
  });

  it("checkJobAlert POSTs to the check endpoint", async () => {
    const fetchMock = stub({ newMatches: 2, total: 5 });
    const res = await checkJobAlert("9");
    expect(res.newMatches).toBe(2);
    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/job-alerts/9/check");
  });

  it("deleteJobAlert DELETEs the id", async () => {
    const fetchMock = stub(null);
    await deleteJobAlert("9");
    const c = call(fetchMock);
    expect(c.method).toBe("DELETE");
    expect(c.url).toContain("/api/job-alerts/9");
  });
});
