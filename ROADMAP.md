# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-07-07_

All tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, **feature (FEAT-\*)**,
and **bug (BUG-\*)** roadmap items are complete — including the résumé ↔ job
matching epic (FEAT-21), job discovery & aggregation (FEAT-22), interview &
research prep, tracking & integrations, and the match-score de-contamination
work (FEAT-31). The completed history has been pruned from this file; it lives in
git and in the PR record.

What remains is: a few **manual, outward-facing release steps**, and a fresh
batch of **codebase-audit cleanups (AUD-\*)** logged 2026-07-06.

---

## ⬜ Release prep (manual / outward-facing)

The cross-platform build + tag-driven release workflow is wired and an on-theme
placeholder app icon is in place. The remaining steps need your credentials and a
real tag push, so they can't be automated here:

- [ ] **Configure signing / notarization secrets in GitHub Actions** (per-OS:
      Windows code-signing cert, macOS Developer ID + notarization credentials).
      Builds succeed unsigned when these are absent. _(Manual — needs your
      certificates; secret names documented in
      [`careerlog-desktop/RELEASING.md`](careerlog-desktop/RELEASING.md).)_
- [ ] **Cut the first cross-platform tagged release and verify auto-update.**
      _(Manual / outward-facing — tag-push steps in
      [`careerlog-desktop/RELEASING.md`](careerlog-desktop/RELEASING.md). Note:
      the release workflow is nested under `careerlog-desktop/.github/` and must
      live at the repo root to trigger.)_
- [ ] **Replace placeholder branding before a public release** — the app icon
      ([`careerlog-desktop/assets/icon.png`](careerlog-desktop/assets/icon.png))
      is an on-theme placeholder, and the renderer favicon is still the default
      Vite logo (see AUD-02).

---

## ⬜ Codebase audit (2026-07-06)

Findings from a multi-pass audit of the whole monorepo (backend, desktop
renderer, Electron shell, browser extension, docs/config). The safe-removal
batch (AUD-01…06) has since been implemented; the remaining items are still
open. Tooling baseline at audit time: `ruff` (F, E9) **clean**, `tsc --noEmit`
**clean**, `eslint` **clean**; the items below came from deeper reads plus `ruff`
extended rules and a `ts-prune` unused-export scan.

### Dead code & unused files (safe removals)

_AUD-01…05 shipped 2026-07-07 on `chore/dead-code-cleanup` (tsc/eslint/ruff clean;
backend 293 + desktop 82 tests green)._

- [x] **AUD-01 — Delete unused desktop components.**
      [`components/common/Button.tsx`](careerlog-desktop/src/components/common/Button.tsx)
      and
      [`components/common/Loader.tsx`](careerlog-desktop/src/components/common/Loader.tsx)
      are imported nowhere (confirmed via `ts-prune` + repo-wide grep for both
      the import path and JSX usage).
- [x] **AUD-02 — Remove leftover Vite template files.**
      [`src/App.css`](careerlog-desktop/src/App.css) is never imported (only
      `index.css` is, in `main.tsx`), and
      [`src/assets/react.svg`](careerlog-desktop/src/assets/react.svg) is
      unreferenced. The default `public/vite.svg` is still wired as the renderer
      favicon in `index.html` — replace with real branding (tracked with the
      Release-prep branding item above).
- [x] **AUD-03 — Drop the unused `react-confirm` dependency.** It's declared in
      [`careerlog-desktop/package.json`](careerlog-desktop/package.json) but
      imported nowhere — confirmation dialogs are hand-rolled in
      [`confirmController.ts`](careerlog-desktop/src/components/common/dialogs/confirmController.ts).
      Remove the dep (and its mention in the architecture doc — see AUD-17).
- [x] **AUD-04 — Remove dead code in the matching engine.** In
      [`app/matching/analyze.py`](backend-app-tracker/app/matching/analyze.py)
      the module-level `_KIND_RANK` constant is referenced nowhere, and the local
      `add()` closure inside `analyze_job` takes a `kind` parameter that every
      call passes (`section.kind`) but the body never reads. Drop both.
- [x] **AUD-05 — Remove the unused `HelpTextKey` type export** in
      [`job-form/config/helpText.ts`](careerlog-desktop/src/components/jobs/job-form/config/helpText.ts)
      (exported, used nowhere).

### Build hygiene / gitignore

- [x] **AUD-06 — Stop tracking compiled Electron output.**
      `careerlog-desktop/electron-dist/main.js` and `preload.js` are build
      artifacts of `electron/main.ts` / `electron/preload.ts` (produced by
      `npm run build:electron:ts`) yet are committed. Add `electron-dist/` to
      [`careerlog-desktop/.gitignore`](careerlog-desktop/.gitignore) (which
      currently ignores `dist` but not `electron-dist`) and `git rm --cached`
      the two files.

### Duplication / reuse

_AUD-07 shipped 2026-07-07 on `refactor/crud-helpers` (new `app/common/crud.py`;
ruff clean, backend 293 tests green). AUD-08/09 remain open._

- [x] **AUD-07 — Extract shared CRUD helpers on the backend.** The per-user CRUD
      services duplicate the same boilerplate almost verbatim:
      [`star_stories`](backend-app-tracker/app/star_stories/service.py),
      [`offers`](backend-app-tracker/app/offers/service.py),
      [`saved_searches`](backend-app-tracker/app/saved_searches/service.py), and
      [`job_alerts`](backend-app-tracker/app/job_alerts/service.py) each carry an
      identical `_object_id()` (ObjectId-or-404), an ownership-scoped
      `find_one_and_update` / `delete_one` with the same 404 and "No fields
      provided for update" blocks. Factor these into e.g.
      `app/common/crud.py` (`object_id_or_404`, `owned_update`, `owned_delete`)
      — removes ~30–40 lines per module. Separately, `_clean_tags`
      (star_stories) and `_clean_list`
      ([`preferences`](backend-app-tracker/app/preferences/service.py)) are the
      same trim/de-dupe function — hoist to one shared helper.
- [ ] **AUD-08 — Collapse the discovery filter parameter list.** The ~14-field
      filter set is spelled out three times: the `/discovery/jobs` route query
      params ([`routes.py`](backend-app-tracker/app/discovery/routes.py)), the
      `service.list_jobs` signature, and `_build_query`
      ([`service.py`](backend-app-tracker/app/discovery/service.py)), with a
      hand-written 1:1 forwarding block between them. Introduce a
      `DiscoveryFilters` dataclass/model passed through the layers. This also
      resolves the only real backend complexity flag (`_build_query`: C901 18 /
      PLR0912 17).
- [ ] **AUD-09 — De-duplicate the desktop CRUD pages.** `Offers`, `Stories`,
      `Alerts`, and `Jobs` repeat the same list + form-modal + delete-confirm +
      toast scaffolding. Consider a shared `useCrudResource` hook / generic
      list-page wrapper. _(Lower priority — pages are readable as-is.)_

### Complexity / oversized modules

- [ ] **AUD-10 — Decompose `pages/Discovery.tsx`.** At **975 lines with 29
      `useState` hooks** in one component
      ([`Discovery.tsx`](careerlog-desktop/src/pages/Discovery.tsx)), it's the
      largest and most stateful file in the renderer. Split into a filters panel,
      results list, alerts panel, and preferences child components, and lift the
      query/filter state into a `useDiscovery` hook.
- [ ] **AUD-11 — Simplify `analyze_job`** (C901 12) in
      [`app/matching/analyze.py`](backend-app-tracker/app/matching/analyze.py) by
      extracting the phrase-selection block (multi-word-first selection, then
      unigram fill) into a helper.

### Low-risk hygiene

_AUD-12…14 shipped 2026-07-07 on `chore/lint-hygiene` (ruff clean incl. B904/B905;
backend 293 tests green). AUD-15/16 remain open._

- [x] **AUD-12 — Add exception chaining in
      [`app/common/auth.py`](backend-app-tracker/app/common/auth.py).** The two
      `raise _auth_error(...)` sites inside `except` clauses omitted `from err` /
      `from None` (ruff B904); added `from None` (expected exceptions → clean 401).
- [x] **AUD-13 — Pass `strict=` to the two `zip()` calls** in
      [`app/matching/keywords.py`](backend-app-tracker/app/matching/keywords.py)
      (ruff B905, ~lines 380 and 454) — `strict=False` (a list paired with its own
      tail is intentionally uneven).
- [x] **AUD-14 — Make best-effort GridFS cleanup observable.** Orphan/old-file
      deletes in [`jobs/service.py`](backend-app-tracker/app/jobs/service.py) and
      [`users/service.py`](backend-app-tracker/app/users/service.py) swallowed all
      errors with bare `except: pass`; now log at debug (behavior stays
      best-effort).
- [ ] **AUD-15 — Formatting consistency.** `request()` in
      [`api/client.ts`](careerlog-desktop/src/api/client.ts) mixes 2- and 4-space
      indentation (~lines 203–221); adopting Prettier would prevent this class of
      drift. Minor: the browser extension defaults to `http://localhost:8000`
      while the desktop app + docs use `http://127.0.0.1:8000` — unify.
- [ ] **AUD-16 — Avoid redundant tokenization in scoring** (efficiency only, not
      a hot path). [`scoring.py`](backend-app-tracker/app/matching/scoring.py)
      `score_match` tokenizes the same job text via `keywords.profile` in both
      `_keyword_coverage` and for `job_profile`, and re-analyzes the résumé across
      `analyze_resume` + `keywords.profile`/`vocabulary`. A single shared
      tokenization pass would remove the repeats.

### Documentation

_AUD-17 shipped 2026-07-07 on `docs/refresh-architecture`. AUD-18 remains open._

- [x] **AUD-17 — Refresh [`architecture.md`](architecture.md).** It's linked from
      the README as "the full design" but is substantially stale: it documents
      ~6 of ~17 backend modules (missing `matching`, `discovery`, `preferences`,
      `job_alerts`, `email_tracking`, `company_research`, `interview_prep`,
      `offers`, `star_stories`, `saved_searches`, `notifications`), says "Three
      collections" (now many), lists renderer pages as only "Login, Dashboard,
      Jobs, Alerts" (missing ~12), describes the preload as exposing "just
      `appVersion`" (it now also exposes the `updates` API), states 401 "clears
      the token and redirects" (the client now does a single-flight refresh
      first), lists the now-unused `react-confirm`, and carries a "no offline
      mode" non-goal that
      [`api/offlineCache.ts`](careerlog-desktop/src/api/offlineCache.ts) (used by
      `Jobs` + the auth store) contradicts.
- [ ] **AUD-18 — Reconcile doc naming.** Backend contract docs use uppercase
      `.MD` (`README.MD`, `MONGO_SCHEMA.MD`, `API_CONTRACT_V2.MD`) while the rest
      of the repo uses `.md`, and the file is `API_CONTRACT_V2` while
      README/architecture refer to "API v1". Pick one version label and one
      extension casing. _(Minor.)_
