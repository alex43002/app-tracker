import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";

import { useCrudResource, type CrudApi } from "./useCrudResource";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

interface Row {
  id: string;
  name: string;
  updatedAt?: string;
}
type RowInput = { name: string };

const MESSAGES = {
  loadError: "load failed",
  created: "created",
  updated: "updated",
  deleted: "deleted",
  saveError: "save failed",
  deleteError: "delete failed",
};

/** A fake API backed by an in-memory array, with per-call overrides. */
function fakeApi(
  initial: Row[],
  overrides: Partial<CrudApi<Row, RowInput>> = {},
): CrudApi<Row, RowInput> {
  return {
    list: vi.fn(async () => [...initial]),
    create: vi.fn(async (input: RowInput) => ({ id: "new", ...input })),
    update: vi.fn(async (_id: string, input: RowInput) => ({ ...input })),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("useCrudResource", () => {
  it("loads items on mount and clears loading", async () => {
    const api = fakeApi([{ id: "a", name: "Ada" }]);
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([{ id: "a", name: "Ada" }]);
    expect(api.list).toHaveBeenCalledOnce();
  });

  it("toasts on a load failure", async () => {
    const api = fakeApi([], {
      list: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(toast.error).toHaveBeenCalledWith("load failed");
  });

  it("create prepends the new row and toasts", async () => {
    const api = fakeApi([{ id: "a", name: "Ada" }]);
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.save({ name: "Bo" });
    });

    expect(ok).toBe(true);
    expect(result.current.items).toEqual([
      { id: "new", name: "Bo" },
      { id: "a", name: "Ada" },
    ]);
    expect(toast.success).toHaveBeenCalledWith("created");
  });

  it("update merges the returned patch over the edited row and clears editing", async () => {
    const api = fakeApi([{ id: "a", name: "Ada" }], {
      update: vi.fn(async (_id, input) => ({ ...input, updatedAt: "t1" })),
    });
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.beginEdit("a"));
    expect(result.current.editingItem).toEqual({ id: "a", name: "Ada" });

    await act(async () => {
      await result.current.save({ name: "Ada Lovelace" });
    });

    expect(api.update).toHaveBeenCalledWith("a", { name: "Ada Lovelace" });
    // id preserved, name + updatedAt applied from the merge.
    expect(result.current.items).toEqual([
      { id: "a", name: "Ada Lovelace", updatedAt: "t1" },
    ]);
    expect(result.current.editingId).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("updated");
  });

  it("remove filters the row and clears editing when it was the edited row", async () => {
    const api = fakeApi([
      { id: "a", name: "Ada" },
      { id: "b", name: "Bo" },
    ]);
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.beginEdit("a"));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.remove("a");
    });

    expect(ok).toBe(true);
    expect(result.current.items).toEqual([{ id: "b", name: "Bo" }]);
    expect(result.current.editingId).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("deleted");
  });

  it("keeps the edit state when a different row is removed", async () => {
    const api = fakeApi([
      { id: "a", name: "Ada" },
      { id: "b", name: "Bo" },
    ]);
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.beginEdit("a"));
    await act(async () => {
      await result.current.remove("b");
    });
    expect(result.current.editingId).toBe("a");
  });

  it("returns false and toasts on a save failure without mutating the list", async () => {
    const api = fakeApi([{ id: "a", name: "Ada" }], {
      create: vi.fn(async () => {
        throw new Error("nope");
      }),
    });
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.save({ name: "Bo" });
    });

    expect(ok).toBe(false);
    expect(result.current.items).toEqual([{ id: "a", name: "Ada" }]);
    expect(result.current.saving).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("save failed");
  });

  it("returns false and toasts on a delete failure", async () => {
    const api = fakeApi([{ id: "a", name: "Ada" }], {
      remove: vi.fn(async () => {
        throw new Error("nope");
      }),
    });
    const { result } = renderHook(() => useCrudResource(api, MESSAGES));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.remove("a");
    });

    expect(ok).toBe(false);
    expect(result.current.items).toEqual([{ id: "a", name: "Ada" }]);
    expect(toast.error).toHaveBeenCalledWith("delete failed");
  });
});
