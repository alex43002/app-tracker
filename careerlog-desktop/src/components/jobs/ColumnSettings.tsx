import { useEffect, useRef, useState } from "react";
import type { ColumnPref } from "./useColumnPreferences";

interface ColumnSettingsProps {
  prefs: ColumnPref[];
  labelOf: (key: string) => string;
  toggle: (key: string) => void;
  move: (key: string, dir: -1 | 1) => void;
  reset: () => void;
}

/**
 * Dropdown for the Jobs table layout preference (FEAT-18): toggle column
 * visibility and reorder columns. At least one column must stay visible.
 */
export function ColumnSettings({
  prefs,
  labelOf,
  toggle,
  move,
  reset,
}: ColumnSettingsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const visibleCount = prefs.filter((p) => p.visible).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="
          inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm
          text-gray-700 hover:bg-gray-50
        "
      >
        <svg
          className="h-4 w-4 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <line x1="8" y1="4" x2="8" y2="20" />
          <line x1="16" y1="4" x2="16" y2="20" />
          <rect x="3" y="4" width="18" height="16" rx="2" />
        </svg>
        Columns
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg
            border border-gray-200 bg-white shadow-lg
          "
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Columns
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-blue-600 hover:underline"
            >
              Reset
            </button>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {prefs.map((p, idx) => {
              const lastVisible = p.visible && visibleCount === 1;
              return (
                <li
                  key={p.key}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                >
                  <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={p.visible}
                      disabled={lastVisible}
                      onChange={() => toggle(p.key)}
                      title={
                        lastVisible
                          ? "At least one column must stay visible"
                          : undefined
                      }
                    />
                    {labelOf(p.key)}
                  </label>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${labelOf(p.key)} up`}
                      disabled={idx === 0}
                      onClick={() => move(p.key, -1)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${labelOf(p.key)} down`}
                      disabled={idx === prefs.length - 1}
                      onClick={() => move(p.key, 1)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
