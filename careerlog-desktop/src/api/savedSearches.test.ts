import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSavedSearch,
  deleteSavedSearch,
  fetchSavedSearches,
  updateSavedSearch,
} from "./savedSearches";

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

describe("saved searches api", () => {
  it("fetchSavedSearches unwraps the items array", async () => {
    const fetchMock = stub({
      items: [
        {
          id: "1",
          name: "Remote",
          filters: { location: "Remote" },
          sortBy: "createdAt",
          sortOrder: "asc",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const items = await fetchSavedSearches();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Remote");
    expect(call(fetchMock).url).toContain("/api/saved-searches/");
  });

  it("createSavedSearch POSTs the payload as JSON", async () => {
    const fetchMock = stub({ id: "9", name: "Offers" });
    await createSavedSearch({ name: "Offers", filters: { status: "offer" } });
    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(JSON.parse(c.body as string)).toEqual({
      name: "Offers",
      filters: { status: "offer" },
    });
  });

  it("updateSavedSearch PUTs to the id", async () => {
    const fetchMock = stub({ id: "9", name: "Renamed" });
    await updateSavedSearch("9", { name: "Renamed" });
    const c = call(fetchMock);
    expect(c.method).toBe("PUT");
    expect(c.url).toContain("/api/saved-searches/9");
  });

  it("deleteSavedSearch DELETEs the id", async () => {
    const fetchMock = stub(null);
    await deleteSavedSearch("9");
    const c = call(fetchMock);
    expect(c.method).toBe("DELETE");
    expect(c.url).toContain("/api/saved-searches/9");
  });
});
