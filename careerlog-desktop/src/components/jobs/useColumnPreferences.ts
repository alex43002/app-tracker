import { useCallback, useEffect, useMemo, useState } from "react";
import { JOB_COLUMNS, type JobColumn } from "./jobColumns";

/**
 * Jobs table layout preference (FEAT-18): column order + visibility, persisted
 * locally. This is deliberately separate from Saved Searches (which persist
 * filters/sort): a saved search is *what* you're looking at, a column layout is
 * *how* it's displayed. Stored in localStorage so it survives reloads without a
 * backend round-trip.
 */
const STORAGE_KEY = "careerlog:jobColumns:v1";

export interface ColumnPref {
  key: string;
  visible: boolean;
}

const DEFAULT_PREFS: ColumnPref[] = JOB_COLUMNS.map((c) => ({
  key: c.key,
  visible: true,
}));

/**
 * Reconcile a stored preference with the current column set: keep the stored
 * order/visibility for columns that still exist, drop unknown keys, and append
 * any newly-added columns (visible) so upgrades don't hide new data.
 */
function reconcile(stored: ColumnPref[]): ColumnPref[] {
  const known = new Set(JOB_COLUMNS.map((c) => c.key));
  const kept = stored.filter((p) => known.has(p.key));
  const seen = new Set(kept.map((p) => p.key));
  const appended = JOB_COLUMNS.filter((c) => !seen.has(c.key)).map((c) => ({
    key: c.key,
    visible: true,
  }));
  return [...kept, ...appended];
}

function loadPrefs(): ColumnPref[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PREFS;
    return reconcile(
      parsed.filter(
        (p): p is ColumnPref =>
          p && typeof p.key === "string" && typeof p.visible === "boolean"
      )
    );
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useColumnPreferences() {
  const [prefs, setPrefs] = useState<ColumnPref[]>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Persistence is best-effort; ignore quota/availability errors.
    }
  }, [prefs]);

  const byKey = useMemo(
    () => new Map(JOB_COLUMNS.map((c) => [c.key, c])),
    []
  );

  /** Resolved, ordered, visible column definitions for rendering. */
  const orderedVisible: JobColumn[] = useMemo(
    () =>
      prefs
        .filter((p) => p.visible)
        .map((p) => byKey.get(p.key))
        .filter((c): c is JobColumn => Boolean(c)),
    [prefs, byKey]
  );

  const toggle = useCallback((key: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.key === key ? { ...p, visible: !p.visible } : p))
    );
  }, []);

  const move = useCallback((key: string, dir: -1 | 1) => {
    setPrefs((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      const next = idx + dir;
      if (idx === -1 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }, []);

  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  /** Label lookup for the picker UI. */
  const labelOf = useCallback(
    (key: string) => byKey.get(key)?.label ?? key,
    [byKey]
  );

  return { prefs, orderedVisible, toggle, move, reset, labelOf };
}
