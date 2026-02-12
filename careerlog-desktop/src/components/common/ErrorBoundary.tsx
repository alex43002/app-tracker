import React from "react";

/**
 * CrashReport
 *
 * Minimal, structured payload representing a renderer crash.
 * This is safe to persist locally or forward to the main process
 * for file-based logging or telemetry.
 */
type CrashReport = {
  message: string;         // Error message for quick triage
  stack?: string;          // Stack trace (if available)
  route: string;           // Current route at time of crash
  occurredAt: string;      // ISO timestamp of crash occurrence
};

/**
 * ErrorBoundaryState
 *
 * Tracks whether the renderer is currently in a crashed state.
 * crashId is used for user-visible correlation and support workflows.
 */
type ErrorBoundaryState = {
  hasError: boolean;
  crashId?: string;
};

/**
 * createCrashReport
 *
 * Normalizes a raw Error into a structured crash payload.
 * This keeps logging concerns separate from React lifecycle logic,
 * which improves testability and long-term maintainability.
 */
function createCrashReport(error: Error): CrashReport {
  return {
    message: error.message,
    stack: error.stack,
    route: window.location.pathname,
    occurredAt: new Date().toISOString(),
  };
}

/**
 * persistCrashReport
 *
 * Best-effort persistence of crash diagnostics.
 * This must NEVER throw — error logging is intentionally isolated
 * so that logging failures cannot cascade into additional crashes.
 */
function persistCrashReport(report: CrashReport) {
  try {
    // Local persistence allows post-crash inspection without external telemetry.
    localStorage.setItem("last_crash", JSON.stringify(report));

    // Optional: forward to Electron main process for file logging or analytics.
    (window as any).electron?.crashReport?.(report);
  } catch {
    // Swallow all errors to prevent logging failures from crashing the UI.
  }
}

/**
 * ErrorBoundary
 *
 * Global renderer-level crash containment.
 *
 * Responsibilities:
 * - Prevent white-screen failures in production
 * - Provide a deterministic recovery UX
 * - Capture crash diagnostics for debugging and support
 *
 * Non-responsibilities:
 * - Fixing application logic errors
 * - Handling domain-level validation or API failures
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  /**
   * React lifecycle hook invoked when a descendant throws during render.
   * This updates local state to trigger the fallback UI.
   */
  static getDerivedStateFromError() {
    return { hasError: true, crashId: crypto.randomUUID() };
  }

  /**
   * React lifecycle hook for side effects after a render crash.
   * Used exclusively for diagnostics and crash reporting.
   */
  componentDidCatch(error: Error) {
    const report = createCrashReport(error);

    // Console logging is useful during development and local debugging.
    console.error("Renderer crashed:", report);

    // Persist crash diagnostics for post-mortem inspection.
    persistCrashReport(report);
  }

  /**
   * Deterministic recovery path.
   * Reloading the renderer is the safest general-purpose recovery action.
   */
  handleReload = () => {
    window.location.reload();
  };

  /**
   * Explicit termination path.
   * Useful when the renderer is in an unrecoverable state.
   */
  handleExit = () => {
    window.close();
  };

  render() {
    // Normal operation: render application subtree.
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Crash fallback UI: intentionally simple and deterministic.
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Something went wrong
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            The application encountered an unexpected error and could not
            continue rendering.
          </p>

          {/* Correlation identifier for support and log lookup */}
          <p className="mt-1 text-xs text-gray-500">
            Error ID: {this.state.crashId}
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={this.handleReload}
              className="rounded bg-black px-4 py-2 text-sm text-white"
            >
              Reload
            </button>

            <button
              onClick={this.handleExit}
              className="rounded border px-4 py-2 text-sm"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }
}