import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useJobForm } from "./useJobForm";

describe("useJobForm server errors (FEAT-2 follow-up)", () => {
  it("merges server field errors and marks those fields touched", () => {
    const { result } = renderHook(() => useJobForm({ job: null }));

    act(() => {
      result.current.setServerErrors({
        salaryTarget: "Must be positive",
        url: "Invalid URL",
      });
    });

    expect(result.current.errors.salaryTarget).toBe("Must be positive");
    expect(result.current.errors.url).toBe("Invalid URL");
    expect(result.current.touched.salaryTarget).toBe(true);
    expect(result.current.touched.url).toBe(true);
  });

  it("is a no-op when there are no server errors", () => {
    const { result } = renderHook(() => useJobForm({ job: null }));

    act(() => {
      result.current.setServerErrors({});
    });

    expect(Object.keys(result.current.errors)).toHaveLength(0);
  });
});
