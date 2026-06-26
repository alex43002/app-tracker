# CareerLog Desktop — Electron Frontend

CareerLog Desktop is a **Windows-first Electron application** that allows users to log in and manage their job applications using the CareerLog REST API (v1).  
This repository contains the **frontend desktop client only**. All data persistence and business logic live in the backend.

The frontend is intentionally lightweight, typed, and stable to support rapid iteration and future store distribution.

---

## What This Application Does

CareerLog Desktop allows a user to:

- Authenticate with the CareerLog backend
- View, create, update, and delete job applications
- Track job application status and notes
- Configure follow-up alerts (configuration only)
- Manage their local session securely

This application **does not**:
- Store authoritative data locally
- Send emails or SMS
- Execute background jobs
- Perform backend logic

---

## Tech Stack

- **Electron** — Desktop runtime
- **React + TypeScript** — UI layer
- **Vite (stable)** — Frontend bundler (rolldown disabled)
- **electron-builder** — cross-platform packaging (Windows, macOS, Linux)
- **Node.js** — Main process only

---

## Repository Structure

```

careerlog-desktop/
│
├── electron/
│   ├── main.ts            # Electron main process
│   └── preload.ts         # Secure IPC bridge
│
├── src/
│   ├── api/               # Typed API client
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── jobs.ts
│   │   └── alerts.ts
│   │
│   ├── pages/             # Screen-level pages
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Jobs.tsx
│   │   └── Alerts.tsx
│   │
│   ├── components/        # Reusable UI components
│   ├── layouts/           # Application layouts
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Client-side state
│   ├── types/             # API and domain types
│   └── utils/             # Shared helpers
│
├── public/
├── electron-builder.yml
├── vite.config.ts
├── package.json
└── README.md

````

---

## Prerequisites

- **Node.js 18+**
- **npm** (bundled with Node)

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
````

---

### 2. Run in Development Mode

```bash
npm run dev
```

This starts:

* Vite dev server for React
* Electron main process
* Hot reload for UI changes

---

### 3. Build for Production

```bash
npm run build
```

---

### 4. Package Installers Locally

```bash
npm run dist
```

`electron-builder` packages for the **current OS** and writes artifacts to
`release-artifacts/`. Run it on Windows for `.exe` (NSIS), on macOS for `.dmg` +
`.zip`, and on Linux for `.AppImage` + `.deb`.

---

## Building & Releasing

### Targets

| Platform | Targets | Notes |
| --- | --- | --- |
| Windows | `nsis` | Installer (`.exe`) |
| macOS | `dmg`, `zip` | `zip` is required for auto-update |
| Linux | `AppImage`, `deb` | |

App icons live in [`assets/`](assets/README.md) — add a 1024×1024 `icon.png`
before cutting a branded release (otherwise the default Electron icon is used).

### Cutting a release (CI)

Releases are built and published by the
[`Release Desktop`](.github/workflows/release.yml) workflow, which runs
`electron-builder` on macOS, Windows, and Linux runners and uploads the
artifacts to the matching GitHub Release.

1. Bump `version` in `package.json`.
2. Tag and push: `git tag v0.1.4 && git push origin v0.1.4`
   (or run the workflow manually via **workflow_dispatch**).

Auto-update is wired via `electron-updater` against these GitHub Releases.

### Code signing & notarization

Signing happens automatically when the relevant secrets are configured; if
they're absent the build still succeeds but produces **unsigned** artifacts.
Configure these repository secrets:

| Secret | Platform | Purpose |
| --- | --- | --- |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` | Windows | base64 `.pfx` cert + password |
| `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD` | macOS | base64 `.p12` cert + password |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | macOS | notarization (Apple notary service) |

`GITHUB_TOKEN` (provided automatically by Actions) is used to publish the
release. The macOS hardened-runtime entitlements live in
`assets/entitlements.mac.plist`.

---

## Backend Dependency

This application **requires** the CareerLog REST API (v1) to be running.

Default local backend:

```
http://127.0.0.1:8000
```

The frontend assumes:

* JWT-based authentication
* Stable response envelopes
* Pagination on all list endpoints
* Alerts are configuration-only in v1

---

## Security Model

* No Node APIs exposed to the renderer
* All privileged access goes through `preload.ts`
* JWT stored client-side (session scoped)
* No secrets embedded in the frontend

---

## Design Constraints (Intentional)

* Windows-first support
* No real-time updates
* No offline mode in v1
* No backend assumptions beyond the contract
* Stability prioritized over experimental tooling

---

## Versioning

This repository targets **CareerLog API v1**.

Breaking frontend changes must align with backend versioning.

---

## Roadmap (High Level)

* UI polish and accessibility
* Installer branding
* Auto-update support
* Optional offline caching (future)
* v2 backend feature adoption

---

## License

MIT