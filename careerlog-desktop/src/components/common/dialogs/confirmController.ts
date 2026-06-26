/**
 * Imperative controller for the global confirm dialog.
 *
 * Kept separate from the component module so `ConfirmDialog.tsx` can export
 * only its component (satisfies react-refresh/only-export-components).
 */

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type OpenFn = (opts: ConfirmDialogOptions) => Promise<boolean>;

let openDialog: OpenFn | null = null;

/** Called by the mounted host to register/unregister its open handler. */
export function registerConfirmDialog(fn: OpenFn): () => void {
  openDialog = fn;
  return () => {
    if (openDialog === fn) openDialog = null;
  };
}

/** Open the confirm dialog and resolve to the user's choice. */
export function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  if (!openDialog) {
    throw new Error("ConfirmDialog is not mounted.");
  }
  return openDialog(options);
}
