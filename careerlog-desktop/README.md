# CareerLog — Desktop Client

This folder (`careerlog-desktop/`) is the **frontend desktop application** for
CareerLog. It's a **Windows-first Electron app** built with **React +
TypeScript** that talks to the CareerLog REST API in
[`../backend-app-tracker/`](../backend-app-tracker). This repo contains the
**client only** — all data persistence and business logic live in the backend.

## What this application does

CareerLog Desktop lets a user:

- Authenticate with the CareerLog backend (login / signup, password reset,
  email verification)
- View, create, update, and delete job applications (with notes and status)
- Attach and preview **multiple résumés** per job
- Filter, sort, and save **named searches** of their job list
- See an analytics dashboard (funnel, applications over time, time-to-offer,
  per-company breakdown)
- Configure follow-up alerts (configuration only — delivery happens server-side)
- View last-cached data when briefly offline (read-only)

It **does not** store authoritative data locally, send email/SMS, or run
background jobs — those are backend responsibilities.

---

## Requirements

- **Node.js 20+** (LTS recommended) and **npm** (bundled with Node)
- A running **CareerLog backend** (see [`../backend-app-tracker/`](../backend-app-tracker)).
  Defaults to `http://127.0.0.1:8000`.

---

## Running it locally

### 1. Install dependencies

```bash
cd careerlog-desktop
npm install
```

### 2. Configure the backend URL

The client needs to know where the API is. Copy the example env file and adjust
if needed (it must not have a trailing slash):

```bash
cp .env.example .env
```

```env
# .env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> If `VITE_API_BASE_URL` is unset the app throws a clear error at startup rather
> than silently making requests to `undefined/api/...`.

### 3. Run in development mode

Make sure the backend is running first, then:

```bash
npm run dev
```

This starts the Vite dev server, the Electron main process, and hot reload for
UI changes.

### 4. Run the tests / checks

```bash
npm run test                        # vitest (48 tests)
npx tsc -p tsconfig.app.json --noEmit   # typecheck
npx eslint .                        # lint (0 warnings)
```

### 5. Build / package locally

```bash
npm run build       # compile renderer + electron, then run electron-builder
npm run dist        # package installers for the current OS → release-artifacts/
```

`electron-builder` packages for the **current OS** only: run it on Windows for
`.exe` (NSIS), macOS for `.dmg` + `.zip`, and Linux for `.AppImage` + `.deb`.

---

## Tech stack

- **Electron** — desktop runtime (hardened: no Node APIs in the renderer; all
  privileged access via `electron/preload.ts`)
- **React + TypeScript** — UI layer
- **Vite** — bundler / dev server
- **Tailwind CSS** — styling
- **Vitest + Testing Library** — tests
- **electron-builder** — cross-platform packaging (config lives in `package.json` → `build`)

---

## Repository structure

```
careerlog-desktop/
├── electron/
│   ├── main.ts            # Electron main process
│   └── preload.ts         # Secure IPC bridge
├── src/
│   ├── api/               # Typed API client (client, auth, jobs, alerts,
│   │                      #   analytics, savedSearches, offlineCache)
│   ├── pages/             # Screen-level pages (Login, Dashboard, Jobs, Alerts,
│   │                      #   ResetPassword, VerifyEmail)
│   ├── components/        # Reusable UI (dashboard, jobs, job-form, auth, common)
│   ├── layouts/           # Application layouts
│   ├── store/             # Client-side auth/session state
│   ├── types/             # API and domain types
│   └── test/              # Vitest setup
├── assets/                # App icon + macOS entitlements (see assets/README.md)
├── public/
├── vite.config.ts
├── vitest.config.ts
├── package.json           # scripts + electron-builder `build` config
└── README.md
```

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

## Security model

- No Node APIs exposed to the renderer; privileged access goes through `preload.ts`
- JWT access/refresh tokens stored client-side (session scoped); silent refresh on 401
- Any cached offline data is cleared on logout so it can't leak across accounts
- No secrets embedded in the frontend

---

## Versioning

This client targets **CareerLog API v1/v2**. Breaking frontend changes must align
with backend versioning. See [`../backend-app-tracker/API_CONTRACT_V2.MD`](../backend-app-tracker/API_CONTRACT_V2.MD).

---

## License

MIT
