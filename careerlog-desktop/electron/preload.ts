import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

/** Update lifecycle status pushed from the main process (FEAT-29). */
type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version?: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version?: string }
  | { state: "error"; message: string };

contextBridge.exposeInMainWorld("careerlog", {
  appVersion: process.env.npm_package_version,

  // Automatic updates (FEAT-29). The renderer subscribes to status, can
  // trigger a manual check, and applies a downloaded update on demand.
  updates: {
    onStatus: (callback: (status: UpdateStatus) => void) => {
      const listener = (_event: IpcRendererEvent, status: UpdateStatus) =>
        callback(status);
      ipcRenderer.on("update:status", listener);
      return () => ipcRenderer.removeListener("update:status", listener);
    },
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
  },
});
