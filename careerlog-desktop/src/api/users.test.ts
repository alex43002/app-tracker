import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadProfilePicture, fetchProfilePicture } from "./users";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("profile picture api", () => {
  it("uploadProfilePicture POSTs multipart to the pfp endpoint", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { pfp: "abc123", updatedAt: "2026-01-01T00:00:00Z" },
        error: null,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([new Uint8Array([1, 2, 3])], "a.png", {
      type: "image/png",
    });
    const res = await uploadProfilePicture("user-1", file);

    expect(res.pfp).toBe("abc123");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/users/user-1/pfp");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("fetchProfilePicture returns an object URL on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () =>
          new Blob([new Uint8Array([1])], { type: "image/png" }),
      })),
    );
    const createObjectURL = vi.fn(() => "blob:fake-url");
    vi.stubGlobal("URL", { ...URL, createObjectURL });

    const url = await fetchProfilePicture("user-1");
    expect(url).toBe("blob:fake-url");
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it("fetchProfilePicture returns null when there is no picture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        blob: async () => new Blob(),
      })),
    );
    expect(await fetchProfilePicture("user-1")).toBeNull();
  });
});
