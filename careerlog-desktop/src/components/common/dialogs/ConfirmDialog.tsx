import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type InternalState = ConfirmDialogOptions & {
  open: boolean;
  resolve?: (value: boolean) => void;
};

let openDialog: ((opts: ConfirmDialogOptions) => Promise<boolean>) | null = null;

export function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  if (!openDialog) {
    throw new Error("ConfirmDialog is not mounted.");
  }
  return openDialog(options);
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<InternalState>({
    open: false,
    title: "",
  });

  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openDialog = (opts) => {
      lastActiveRef.current = document.activeElement as HTMLElement;
      return new Promise<boolean>((resolve) => {
        setState({ ...opts, open: true, resolve });
      });
    };
    return () => {
      openDialog = null;
    };
  }, []);

  useEffect(() => {
    if (!state.open) return;

    const el = dialogRef.current;
    el?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleCancel();
      }
      if (e.key === "Tab") {
        trapFocus(e);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state.open]);

  function trapFocus(e: KeyboardEvent) {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function close(result: boolean) {
    state.resolve?.(result);
    setState((s) => ({ ...s, open: false, resolve: undefined }));
    setLoading(false);
    lastActiveRef.current?.focus();
  }

  function handleConfirm() {
    if (loading) return;
    setLoading(true);
    close(true);
  }

  function handleCancel() {
    if (loading) return;
    close(false);
  }

  if (!state.open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl outline-none"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {state.title}
        </h2>

        {state.description && (
          <p id="confirm-desc" className="mt-2 text-sm text-gray-600">
            {state.description}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {state.cancelLabel ?? "Cancel"}
          </button>

          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50 ${
              state.destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {state.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}