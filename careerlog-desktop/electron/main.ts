import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  /* ============================================================
     Load content
  ============================================================ */

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  /* ============================================================
     Content Security Policy (CSP)
  ============================================================ */

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            // `blob:` is required by img-src so object URLs (e.g. the profile
            // picture, fetched as a blob and shown via URL.createObjectURL) can
            // render; without an explicit img-src they fall back to default-src.
            isDev
              ? "default-src 'self' http://localhost:5173 'unsafe-eval' 'unsafe-inline'; img-src 'self' http://localhost:5173 data: blob:; connect-src *;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src https:;",
          ],
        },
      });
    },
  );

  /* ============================================================
     External Navigation Guard
  ============================================================ */

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isDev) {
      if (!url.startsWith("http://localhost:5173")) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } else {
      if (!url.startsWith("file://")) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  /* ============================================================
     DevTools Lockdown (Production)
  ============================================================ */

  if (!isDev) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  /* ============================================================
     Window Initialization Fallback
  ============================================================ */

  mainWindow.webContents.on("did-fail-load", (_, code, desc) => {
    console.error("did-fail-load:", code, desc);
    mainWindow?.reload();
    mainWindow?.show();
  });

  mainWindow.webContents.on("render-process-gone", (_, details) => {
    console.error("renderer-process-gone:", details);
    mainWindow?.reload();
    mainWindow?.show();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn("Forcing window show (ready-to-show did not fire)");
      mainWindow.show();
    }
  }, 3000);
}

/* ============================================================
   Automatic updates (FEAT-29)

   Discord-style background updates from the GitHub releases the
   tag-driven release workflow publishes: check on launch and on a
   schedule, download in the background, and let the user apply the
   update on next restart. Status is forwarded to the renderer so the
   UI can show progress and a "restart to update" prompt.
============================================================ */

// How often to re-check while the app stays open (6 hours).
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version?: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version?: string }
  | { state: "error"; message: string };

function broadcastUpdateStatus(status: UpdateStatus) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update:status", status);
  }
}

let autoUpdatesStarted = false;

function setupAutoUpdates() {
  // electron-updater can't run against an unpackaged dev build.
  if (isDev || autoUpdatesStarted) return;
  autoUpdatesStarted = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () =>
    broadcastUpdateStatus({ state: "checking" }),
  );
  autoUpdater.on("update-available", (info) =>
    broadcastUpdateStatus({ state: "available", version: info?.version }),
  );
  autoUpdater.on("update-not-available", () =>
    broadcastUpdateStatus({ state: "not-available" }),
  );
  autoUpdater.on("download-progress", (progress) =>
    broadcastUpdateStatus({
      state: "downloading",
      percent: Math.round(progress?.percent ?? 0),
    }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    broadcastUpdateStatus({ state: "downloaded", version: info?.version }),
  );
  autoUpdater.on("error", (err) =>
    broadcastUpdateStatus({
      state: "error",
      message: err?.message ?? "Update failed",
    }),
  );

  // Renderer-driven controls: re-check on demand, and apply a downloaded update.
  ipcMain.handle("update:check", () =>
    autoUpdater.checkForUpdates().catch(() => undefined),
  );
  ipcMain.handle("update:install", () => {
    autoUpdater.quitAndInstall();
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  void check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

/* ============================================================
   App Lifecycle
============================================================ */

app.whenReady().then(() => {
  /* ============================================================
     Permission Hardening (Deny by Default)
  ============================================================ */

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  setupAutoUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
