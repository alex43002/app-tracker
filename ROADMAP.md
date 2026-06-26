# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-06-26_

The previously tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, and
**feature (FEAT-\*)** roadmap items are complete (backend **73 tests + ruff
clean**; desktop **48 tests + typecheck + eslint clean**). This file lists the
**work that is still open**: a batch of product issues found in manual testing
(below), plus ops/release-prep and optional future scaling.

---

## ⬜ Product issues found in manual testing (2026-06-26)

Defects (`BUG-*`) and enhancements (`FEAT-*`) surfaced while exercising the
desktop app by hand. Each entry notes the observed behavior, the suspected
cause in code, and a proposed direction.

### BUG-14 — New profile picture doesn't appear in the header bar

- **Observed:** After uploading a new profile picture, the header avatar keeps
  showing the old image (or the initials fallback) instead of the new one.
- **Where:** [UserMenu.tsx](careerlog-desktop/src/components/common/UserMenu.tsx),
  [users.ts](careerlog-desktop/src/api/users.ts).
- **Suspected causes (multiple, compounding):**
  - On upload, only `UserMenu`'s local `avatarUrl` state is refreshed. The
    parent `user.pfp` (from `fetchCurrentUser`) is never updated, and each page
    (`Dashboard`, `Jobs`) fetches its own `user` and mounts its own `UserMenu`
    — there is no shared user store — so the new picture does not propagate
    across the app and is lost on navigation/remount.
  - `fetchProfilePicture` does a raw `fetch` of the stable URL
    `/api/users/{id}/pfp` with no cache-busting, so the HTTP cache can serve a
    stale (or empty) body after the GridFS object is replaced.
  - The resolve effect keys on `[user.id, user.pfp]`; on the first-ever upload
    `user.pfp` stays `null` in the parent, so re-display depends entirely on
    the one-off local `setAvatarUrl` in `handleFileChange`.
- **Proposed:** Introduce a shared current-user store (or lift `user` + a
  `refreshUser()` into a context/provider) so the avatar updates everywhere
  after upload, and cache-bust the pfp GET (append the `updatedAt`/new pfp id
  as a query param, or use `cache: "no-store"`).

### BUG-15 — Clicking the avatar opens a file picker instead of a settings menu

- **Observed:** Clicking the header avatar immediately prompts to choose a new
  picture.
- **Expected:** Clicking the avatar opens a **user settings menu**; choosing a
  new profile picture is *one item* inside that menu (not the whole click).
- **Where:** [UserMenu.tsx](careerlog-desktop/src/components/common/UserMenu.tsx)
  — the avatar `<button>` `onClick` calls `fileInputRef.current?.click()`
  directly. No settings menu/page currently exists (only `LogoutButton`).
- **Proposed:** Make the avatar toggle a dropdown menu (e.g. Profile / Account
  settings, Change profile picture, Log out). Move the existing file-input flow
  behind the "Change profile picture" item. This pairs naturally with BUG-14
  (the shared user store) and is the seam for a future settings surface.

### BUG-16 — "Recent Jobs" table has no column headers

- **Observed:** The dashboard "Recent Jobs" card shows rows with no header row,
  so it's unclear what each column means.
- **Where:** [RecentJobsTable.tsx](careerlog-desktop/src/components/dashboard/RecentJobsTable.tsx)
  renders only a `<tbody>` (Company / Title / Status) with no `<thead>`.
- **Proposed:** Add a `<thead>` (Company, Title, Status) matching the row cells.

### FEAT-17 — "Applications over time" chart is unclear / looks empty

- **Observed:** The dashboard "Applications over time" widget doesn't appear to
  show any data points, and it isn't obvious what it's meant to convey.
- **Where:** `ApplicationsOverTimeChart` in
  [AnalyticsInsights.tsx](careerlog-desktop/src/components/dashboard/AnalyticsInsights.tsx);
  backed by `GET /api/analytics/applications-over-time`.
- **Cause:** Bars are sized `(count / max) * 100%` inside a bare `h-32` flex
  container with no y-axis, no baseline, no count labels, and no caption
  explaining the metric. With sparse data (e.g. a single month) it reads as one
  full-height bar or as nothing. The backend supports `interval`
  (week/month/quarter), but the UI never passes one (defaults to month) and the
  x-labels are a raw `period.slice(5)`.
- **Proposed:** Add a short caption ("Applications submitted per month"), value
  labels on/above bars, a visible baseline/gridline, an empty-state that's
  distinguishable from "all zeros," and (optionally) an interval toggle
  (week/month/quarter).

### FEAT-18 — Customizable Jobs table columns (reorder + hide), saved as a layout preference

- **Want:** On the Jobs tab, let users reorder columns and hide unused ones,
  and persist that arrangement as a **format/layout preference** — explicitly
  **separate from Saved Searches** (which persist filters + sort, not layout).
- **Where:** [JobsTable.tsx](careerlog-desktop/src/components/jobs/JobsTable.tsx)
  currently hard-codes the column set (Company, Title, Location, Type, Status,
  Salary, Updated, Actions). Saved Searches are a distinct concept
  ([savedSearches.ts](careerlog-desktop/src/api/savedSearches.ts), backend
  `saved_searches`).
- **Proposed:** Model columns as data (key, label, visible, order), render the
  table from that model, and add a column-picker UI (toggle visibility, drag to
  reorder). Persist the layout independently of saved searches — either
  client-side (localStorage, keyed per user) or via a new backend
  `preferences`/`table-layout` endpoint if cross-device sync is desired.

### FEAT-19 — More filters for searching past applications

- **Want:** The Jobs search has too few filters; add more ways to narrow past
  applications.
- **Where:** [JobsToolbar.tsx](careerlog-desktop/src/components/jobs/JobsToolbar.tsx)
  exposes only **status** and **employment type** (plus a client-side text
  search). The backend whitelist
  (`JOB_FILTERABLE_FIELDS = status, employmentType, company, location` in
  [jobs/service.py](backend-app-tracker/app/jobs/service.py)) already supports
  **company** and **location**, which the UI does not surface.
- **Proposed:** Surface company/location filters now (no backend change). For
  richer filters (salary range, date-applied range, has-résumé, etc.) extend
  the backend filter layer — the current whitelist is **exact-match only** and
  rejects Mongo operators (SEC-1), so range filters require deliberate,
  validated server-side support rather than raw operators.

### FEAT-20 — Build real Alerts (remove static mock data)

- **Observed:** The Alerts tab renders 18 hard-coded rows; "+ Add Alert" does
  nothing; a banner says alerts are "configuration records only in v1."
- **Where:** [Alerts.tsx](careerlog-desktop/src/pages/Alerts.tsx) uses
  `MOCK_ALERTS`.
- **Key finding:** The backend is **already built** — full Alerts CRUD
  ([alerts/routes.py](backend-app-tracker/app/alerts/routes.py): create / list /
  update / delete) plus a delivery runner
  ([alerts/runner.py](backend-app-tracker/app/alerts/runner.py)). The frontend
  is the gap: [alerts.ts](careerlog-desktop/src/api/alerts.ts) only has
  `fetchAlerts`, and its `Alert` type
  ([types/alert.ts](careerlog-desktop/src/types/alert.ts)) **mismatches** the
  backend schema (`scheduledAlert`/`smsOrEmail` vs. the page's local
  `scheduledAt`/`channel`).
- **Proposed:** Replace `MOCK_ALERTS` with live data from `GET /api/alerts/`;
  reconcile the `Alert` type with the backend schema; add create/edit/delete
  wired to the existing endpoints; and confirm the delivery runner's actual v1
  capabilities so the banner copy is accurate. (Dashboard's
  [Dashboard.tsx](careerlog-desktop/src/pages/Dashboard.tsx) `UpcomingAlertsList`
  is also fed mock `alerts` and should move to the same source.)

---

## ⬜ Release prep (FEAT-8 follow-up)

The cross-platform build + tag-driven release workflow is wired, but a first
branded, signed release still needs:

- [ ] Add a 1024×1024 `careerlog-desktop/assets/icon.png` (app icon).
- [ ] Configure the signing / notarization secrets in GitHub Actions
      (per-OS: Windows code-signing cert, macOS Developer ID + notarization
      credentials). Builds succeed unsigned when these are absent.
- [ ] Cut the first cross-platform tagged release and verify auto-update.

---

## ⬜ Optional future scaling (only if data volumes grow)

Not needed at current scale; revisit if usage increases:

- [ ] Move the per-user analytics `find` to server-side aggregation (the
      combined `/api/analytics/summary` already cuts this to one fetch per load).
- [ ] Add an APScheduler jobstore (or equivalent) if the alert poll loop itself
      needs deduping across instances — note per-alert delivery is already
      multi-instance safe via the atomic `findAndModify` claim (FEAT-12).
