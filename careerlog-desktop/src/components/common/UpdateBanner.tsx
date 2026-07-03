import { useEffect, useState } from "react";
import type { UpdateStatus } from "../../types/electron";

/* ============================================================
   Automatic update prompt (FEAT-29)

   Listens to the Electron main process's update lifecycle and shows
   an unobtrusive banner: download progress while an update is being
   fetched in the background, and a "Restart to update" prompt once it
   is downloaded. Renders nothing outside Electron (e.g. dev/web) or
   when no update is in flight.
============================================================ */

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const updates = window.careerlog?.updates;
    if (!updates) return;
    return updates.onStatus(setStatus);
  }, []);

  if (!status) return null;
  if (status.state !== "downloading" && status.state !== "downloaded") {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 sm:px-6">
      {status.state === "downloading" ? (
        <span>Downloading update… {status.percent}%</span>
      ) : (
        <span>
          A new version{status.version ? ` (${status.version})` : ""} is ready to
          install.
        </span>
      )}

      {status.state === "downloaded" && (
        <button
          type="button"
          disabled={installing}
          onClick={() => {
            setInstalling(true);
            window.careerlog?.updates?.install();
          }}
          className="shrink-0 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {installing ? "Restarting…" : "Restart to update"}
        </button>
      )}
    </div>
  );
}
