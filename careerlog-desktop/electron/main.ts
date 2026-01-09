import { app, BrowserWindow, session, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";

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
    mainWindow.loadFile(
      path.join(__dirname, "../dist/index.html")
    );
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
            isDev
              ? "default-src 'self' http://localhost:5173 'unsafe-eval' 'unsafe-inline'; connect-src *;"
              : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https:;",
          ],
        },
      });
    }
  );

  /* ============================================================
     External Navigation Guard
  ============================================================ */

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on(
    "will-navigate",
    (event, url) => {
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
    }
  );

  /* ============================================================
     DevTools Lockdown (Production)
  ============================================================ */

  if (!isDev) {
    mainWindow.webContents.on(
      "devtools-opened",
      () => {
        mainWindow?.webContents.closeDevTools();
      }
    );
  }
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
    }
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
