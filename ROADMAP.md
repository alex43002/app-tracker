# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-07-07_

All tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, **feature (FEAT-\*)**,
and **bug (BUG-\*)** items are complete, as is the **first codebase-audit batch**
(AUD-01…08, 11–15, 17, 18). That completed history has been pruned from this
file — it lives in git and in the PR record (#41–#48).

Also **live now**: a branch-protection gate on `main` (repo ruleset) requiring a
**pre-commit** check — `ruff` (incl. **C901** complexity), **Prettier**, **tsc**,
**eslint**, plus generic hygiene — and **CodeQL** code scanning. Coverage runs on
every PR (best-effort; GitHub Code Quality is org-only so it isn't gated here).
See [`.github/CODE_QUALITY_SETUP.md`](.github/CODE_QUALITY_SETUP.md).

What remains: a few **manual release steps**, three **open audit items**
(AUD-09/10/16), and a **second audit pass** (2026-07-07).

---

## ⬜ Release prep (manual / outward-facing)

The cross-platform build + tag-driven release workflow is wired and an on-theme
placeholder app icon is in place. The remaining steps need your credentials and a
real tag push, so they can't be automated here:

- [ ] **Move the release workflow to the repo root so it triggers.**
      `careerlog-desktop/.github/workflows/release.yml` is **nested** — GitHub
      only runs workflows in the repo-root `.github/workflows/`, so it (like the
      old nested `ci.yml`s) never fires. Move it to `.github/workflows/` before
      relying on tag-driven releases.
- [ ] **Configure signing / notarization secrets in GitHub Actions** (per-OS:
      Windows code-signing cert, macOS Developer ID + notarization credentials).
      Builds succeed unsigned when these are absent. _(Manual — needs your
      certificates; secret names in
      [`careerlog-desktop/RELEASING.md`](careerlog-desktop/RELEASING.md).)_
- [ ] **Cut the first cross-platform tagged release and verify auto-update.**
      _(Manual / outward-facing — tag-push steps in
      [`careerlog-desktop/RELEASING.md`](careerlog-desktop/RELEASING.md).)_
- [ ] **Replace placeholder branding before a public release** — the app icon
      ([`careerlog-desktop/assets/icon.png`](careerlog-desktop/assets/icon.png))
      is an on-theme placeholder, and the renderer favicon is still the default
      Vite logo.

---

## ⬜ Codebase audit — still open (from the 2026-07-06 pass)

### Duplication / reuse

- [ ] **AUD-09 — De-duplicate the desktop CRUD pages.** `Offers` (460 lines),
      `Stories`, `Alerts`, and `Jobs` repeat the same list + form-modal +
      delete-confirm + toast scaffolding. A shared `useCrudResource` hook /
      generic list-page wrapper would remove the repetition. _(Frontend, no page
      tests — verify by running the app.)_

### Complexity / oversized modules

- [ ] **AUD-10 — Decompose `pages/Discovery.tsx`.** Now **988 lines with 29
      `useState` hooks** in one component
      ([`Discovery.tsx`](careerlog-desktop/src/pages/Discovery.tsx)) — the largest
      and most stateful file in the renderer. Split into filters-panel, results,
      alerts-panel, and preferences child components, and lift the query/filter
      state into a `useDiscovery` hook. _(Frontend, no direct tests — verify by
      running the app.)_

### Efficiency

- [ ] **AUD-16 — Avoid redundant tokenization in scoring** (efficiency only, not
      a hot path). [`scoring.py`](backend-app-tracker/app/matching/scoring.py)
      `score_match` tokenizes the same job text via `keywords.profile` in both
      `_keyword_coverage` and for `job_profile`, and re-analyzes the résumé across
      `analyze_resume` + `keywords.profile`/`vocabulary`. A shared tokenization
      pass would remove the repeats — but the profiles use different
      `keyword_limit`s, so a clean dedup needs a small `keywords.py` refactor
      (separate tokenization from ranking/limiting) to stay behaviour-preserving.

---

## ⬜ Codebase audit — second pass (2026-07-07)

Re-audited the whole monorepo after the first batch merged. The mechanical
baseline is now **clean and enforced** in the pre-commit CI gate: `ruff`
(F, E9, **C901** at `max-complexity = 10`), `tsc`, `eslint`, and Prettier all
pass. A fresh `knip` + `ts-prune` + dead-function scan found the **backend has no
dead functions** (the first batch's fixes held; `keywords.py` helpers like
`content_tokens`/`stem`/`is_noise_phrase` are all used internally). Only small
desktop leftovers turned up:

- [x] **AUD-19 — Delete the empty dead hook file.**
      `components/jobs/job-form/hooks/useJobFormValidation.ts` was a **0-line
      file** imported nowhere. _(Removed in this PR.)_
- [ ] **AUD-20 — Drop unnecessary `export`s (used in-module only).** `knip` flags
      `STRONG_MATCH_MIN` / `PARTIAL_MATCH_MIN`
      ([`lib/matchReport.ts`](careerlog-desktop/src/lib/matchReport.ts)) and
      `JOB_COLUMNS`
      ([`components/jobs/jobColumns.tsx`](careerlog-desktop/src/components/jobs/jobColumns.tsx))
      as exported constants used only within their own module, plus ~11 exported
      types (`ApiResponse`/`ApiErrorPayload`/`ApiErrorDetail` in
      [`api/client.ts`](careerlog-desktop/src/api/client.ts), `SessionTokens`,
      `UserContextValue`, `MatchReportInput`, `CachedResult`, the job-form config
      types) with no cross-module importer. Drop `export` where the symbol isn't
      part of an intended public surface. _(Cosmetic; verify each — some types may
      be kept deliberately as the module's typed contract.)_

**Bottom line:** the codebase is in good shape. Beyond AUD-09/10 (the two
frontend God-components / CRUD-page duplication) and the minor items above, there
is no meaningful dead code or complexity left to remove — the first audit +
the C901 gate did their job.
