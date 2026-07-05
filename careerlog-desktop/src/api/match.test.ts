import { afterEach, describe, expect, it, vi } from "vitest";
import { extractResume, scoreMatch, scrapeJob } from "./match";

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

describe("match api", () => {
  it("scrapeJob POSTs the url and unwraps the result", async () => {
    const fetchMock = stub({
      title: "Backend Engineer",
      textLength: 100,
      skills: ["python"],
      keywords: ["payments"],
    });
    const res = await scrapeJob("https://jobs.example.com/1");
    expect(res.title).toBe("Backend Engineer");
    expect(res.skills).toContain("python");

    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/match/scrape");
    expect(JSON.parse(c.body as string)).toEqual({
      url: "https://jobs.example.com/1",
    });
  });

  it("scoreMatch POSTs the payload and unwraps the score", async () => {
    const fetchMock = stub({
      score: 82,
      confidence: "high",
      confidenceReason: "Parsed 10 requirement terms.",
      skillSignalAvailable: true,
      roleFamilies: ["Software engineering"],
      coverage: { required: 0.8, responsibility: 0.6, preferred: null, concept: 0.7, keyword: 0.5 },
      strengths: [
        { term: "python", status: "strong", bucket: "required", isConcept: true, evidence: ["python"] },
      ],
      gaps: [{ term: "aws", status: "missing", bucket: "required", isConcept: true, evidence: [] }],
      resume: { skills: ["python"], keywords: [] },
      job: { skills: ["python", "aws"], keywords: [] },
    });

    const res = await scoreMatch({
      resumeId: "r1",
      jobDescription: "Python and AWS",
    });
    expect(res.score).toBe(82);
    expect(res.gaps.map((g) => g.term)).toContain("aws");
    expect(res.coverage.preferred).toBeNull();

    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/match/score");
    expect(JSON.parse(c.body as string)).toEqual({
      resumeId: "r1",
      jobDescription: "Python and AWS",
    });
  });

  it("extractResume POSTs the file as multipart form data", async () => {
    const fetchMock = stub({
      filename: "cv.txt",
      textLength: 42,
      skills: ["python"],
      keywords: [],
      text: "Python developer",
    });

    const file = new File(["Python developer"], "cv.txt", { type: "text/plain" });
    const res = await extractResume(file);
    expect(res.text).toBe("Python developer");
    expect(res.filename).toBe("cv.txt");

    const c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/match/extract-resume");
    // FormData is passed through unchanged (not JSON-stringified).
    expect(c.body).toBeInstanceOf(FormData);
    expect((c.body as FormData).get("resume")).toBeInstanceOf(File);
  });
});
