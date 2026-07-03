export {};

/** Update lifecycle status pushed from the Electron main process (FEAT-29). */
export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version?: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version?: string }
  | { state: "error"; message: string };

declare global {
  interface Window {
    careerlog?: {
      appVersion?: string;
      updates?: {
        /** Subscribe to update status; returns an unsubscribe function. */
        onStatus: (callback: (status: UpdateStatus) => void) => () => void;
        /** Manually trigger an update check. */
        check: () => Promise<unknown>;
        /** Quit and install a downloaded update. */
        install: () => Promise<unknown>;
      };
    };
  }
}
