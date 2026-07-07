import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteJobResume, fetchJobResumes, uploadJobResume } from "./jobs";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stub(data: unknown) {
  const fetchMock = vi.fn(async (..._args: unknown[]) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, error: null }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function call(fetchMock: ReturnType<typeof stub>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, method: init?.method ?? "GET", body: init?.body };
}

describe("job résumés api (FEAT-10)", () => {
  it("fetchJobResumes unwraps the resumes array", async () => {
    const fetchMock = stub({
      resumes: [{ id: "r1", filename: "cv.pdf" }],
    });
    const resumes = await fetchJobResumes("job1");
    expect(resumes).toEqual([{ id: "r1", filename: "cv.pdf" }]);
    expect(call(fetchMock).url).toContain("/api/jobs/job1/resumes");
  });

  it("uploadJobResume POSTs multipart form data", async () => {
    const fetchMock = stub({ id: "r2", filename: "new.pdf" });
    const file = new File([new Uint8Array([1, 2, 3])], "new.pdf", {
      type: "application/pdf",
    });
    const created = await uploadJobResume("job1", file);
    expect(created.id).toBe("r2");

    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/jobs/job1/resumes");
    expect(c.body).toBeInstanceOf(FormData);
    expect((c.body as FormData).get("resume")).toBeInstanceOf(File);
  });

  it("deleteJobResume DELETEs the nested resource", async () => {
    const fetchMock = stub(null);
    await deleteJobResume("job1", "r1");
    const c = call(fetchMock);
    expect(c.method).toBe("DELETE");
    expect(c.url).toContain("/api/jobs/job1/resumes/r1");
  });
});
