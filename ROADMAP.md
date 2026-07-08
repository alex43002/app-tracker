# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-07-07_

All tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, **feature (FEAT-\*)**,
and **bug (BUG-\*)** items are complete, as is the **first codebase-audit batch**
(AUD-01…08, 11–15, 17, 18). That completed history has been pruned from this
file — it lives in git and in the PR record (#41–#48).

Also **live now**: a branch-protection gate on `main` (repo ruleset) requiring a
**pre-commit** check — `ruff` (incl. **C901** complexity), **Prettier**, **tsc**,
**eslint**, plus generic hygiene — and **CodeQL** code scanning. (An earlier
GitHub Code Quality coverage gate was removed — it's org-only, unavailable on a
personal repo; see **AUD-21** for a free-tier replacement.)

What remains: the **manual release steps** (signing secrets, the first tagged
release, and branding), plus two small **audit follow-ups** (AUD-22 / AUD-23)
logged 2026-07-08. The structured audit is otherwise closed — **AUD-20** shipped
on `refactor/aud-20-drop-exports`, after **AUD-09 / AUD-16 / AUD-21** (PRs #55 /
#56 / #57) and the release-workflow move (PR #59).

---

## ⬜ Release prep (manual / outward-facing)

The cross-platform build + tag-driven release workflow is wired and an on-theme
placeholder app icon is in place. The remaining steps need your credentials and a
real tag push, so they can't be automated here:

- [x] **Move the release workflow to the repo root so it triggers.**
      `careerlog-desktop/.github/workflows/release.yml` was **nested** — GitHub
      only runs workflows in the repo-root `.github/workflows/`, so it (like the
      old nested `ci.yml`s) never fired. _(Shipped 2026-07-08 on
      `ci/release-workflow-to-root`: `git mv`'d it to
      [`.github/workflows/release.yml`](.github/workflows/release.yml) with no
      content changes — its `working-directory: careerlog-desktop` and
      `cache-dependency-path: careerlog-desktop/package-lock.json` were already
      repo-root-relative, so it needs no edits to run from the root. Triggers
      only on `v*` tag push / manual dispatch, so it stays dormant until the
      first tagged release below.)_
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

## ✅ Codebase audit — complete (from the 2026-07-06 pass)

### Duplication / reuse

- [x] **AUD-09 — De-duplicate the desktop CRUD pages.** `Offers` (460 lines),
      `Stories`, `Alerts`, and `Jobs` repeat the same list + form-modal +
      delete-confirm + toast scaffolding. A shared `useCrudResource` hook /
      generic list-page wrapper would remove the repetition. _(Shipped 2026-07-08
      on `refactor/crud-pages-dedupe` (PR #55): added
      [`hooks/useCrudResource.ts`](careerlog-desktop/src/hooks/useCrudResource.ts)
      — a shared load/save/delete/edit-tracking state machine with unit tests —
      and rewired `Offers`, `Stories`, and `Alerts` onto it (`Alerts` adapted for
      its paginated list + partial create/update responses). Behaviour-preserving;
      each page keeps its own form + JSX. Desktop suite 90 tests green; `vite
      build` OK. `Jobs` left as-is — its board/columns diverge enough that folding
      it in would add complexity rather than remove it.)_

### Complexity / oversized modules

- [x] **AUD-10 — Decompose `pages/Discovery.tsx`.** Was **988 lines with 29
      `useState` hooks** in one component. _(Shipped 2026-07-08 on
      `refactor/discovery-decompose` (PR #53): lifted all state/effects/handlers
      into a `useDiscovery` hook and split the JSX into 6 presentational panels
      (`ImportBoardPanel`, `DiscoveryFilters`, `PreferencesPanel`,
      `SavedSearchesPanel`, `ResumeFitPanel`, `DiscoveryResults`); `Discovery.tsx`
      is now ~110 lines. Behaviour-preserving — verified by running the app
      (Playwright): login → Discover renders all panels, title/type filters and
      pagination work, zero console errors.)_

### Efficiency

- [x] **AUD-16 — Avoid redundant tokenization in scoring** (efficiency only, not
      a hot path). [`scoring.py`](backend-app-tracker/app/matching/scoring.py)
      `score_match` tokenizes the same job text via `keywords.profile` in both
      `_keyword_coverage` and for `job_profile`, and re-analyzes the résumé across
      `analyze_resume` + `keywords.profile`/`vocabulary`. A shared tokenization
      pass would remove the repeats — but the profiles use different
      `keyword_limit`s, so a clean dedup needs a small `keywords.py` refactor
      (separate tokenization from ranking/limiting) to stay behaviour-preserving.
      _(Shipped 2026-07-08 on `refactor/scoring-tokenization` (PR #56): split
      `keywords.py` ranking from limiting (`ranked_keywords`, `build_profile`,
      `vocabulary(skills=…)`) so `score_match` extracts each text's skills + ranked
      keywords once — measured 4→2 `extract_skills` and 3→2 rankings, with
      identical scores. Invariant tests pin the equivalences; 296 backend tests
      green.)_

---

## ✅ Codebase audit — second pass (2026-07-07)

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
- [x] **AUD-20 — Drop unnecessary `export`s (used in-module only).** `knip` flagged
      `STRONG_MATCH_MIN` / `PARTIAL_MATCH_MIN`
      ([`lib/matchReport.ts`](careerlog-desktop/src/lib/matchReport.ts)) and
      `JOB_COLUMNS`
      ([`components/jobs/jobColumns.tsx`](careerlog-desktop/src/components/jobs/jobColumns.tsx))
      as exported constants used only within their own module, plus exported
      types (`ApiResponse`/`ApiErrorPayload`/`ApiErrorDetail` in
      [`api/client.ts`](careerlog-desktop/src/api/client.ts), `SessionTokens`,
      `UserContextValue`, `MatchReportInput`, `CachedResult`, the job-form config
      types) with no cross-module importer. _(Shipped 2026-07-08 on
      `refactor/aud-20-drop-exports`: dropped `export` from 14 in-module-only
      symbols across 9 files — the two `matchReport` consts + `JOB_COLUMNS`;
      `ApiResponse` / `ApiErrorPayload` / `ApiErrorDetail`; both `SessionTokens`
      (`api/auth.ts` + `store/auth.ts`); `UserContextValue`; `MatchReportInput`;
      `CachedResult`; and the job-form `JobFormSectionKey` / `JobFormFieldConfig`
      / `ValidationRule`. Verified each had zero cross-module importers first, and
      deliberately **kept** the JobForm contract types (`JobFormValues`,
      `JobFormErrors`, `UseJobFormResult`, `JobFormSavePayload`,
      `JobFormInitOptions`, `JobFormFieldKey`) exported — sibling modules import
      them. `tsc` + `eslint` (0 errors) + Prettier clean; 90 desktop tests green.)_

**Bottom line:** the codebase is in good shape. With **AUD-20** now shipped, both
structured audit passes are done — no meaningful dead code, complexity, or stray
export left; the first audit + the C901 gate did their job. Two small pre-existing
items surfaced while shipping it (**AUD-22 / AUD-23** below) are logged for a
future pass; neither is CI-breaking.

---

## ⬜ Codebase audit — follow-ups (surfaced 2026-07-08 during AUD-20)

Two pre-existing issues noticed while shipping AUD-20 — both outside that PR's
scope, recorded here so they aren't lost. Neither is CI-breaking.

- [ ] **AUD-22 — De-duplicate the `SessionTokens` interface.** The identical
      4-field token shape (`jwt` / `expiresAt` / `refreshToken` /
      `refreshExpiresAt`) is declared twice —
      [`api/auth.ts`](careerlog-desktop/src/api/auth.ts) and
      [`store/auth.ts`](careerlog-desktop/src/store/auth.ts). Pick one canonical
      definition and import it in the other (or hoist to `types/`).
      Behaviour-preserving. _(Both were de-`export`ed in AUD-20; consolidating
      re-adds a single `export` on the canonical module.)_
- [ ] **AUD-23 — Add a `.gitattributes` to normalize line endings to LF.** The
      repo has no `.gitattributes`, so with `core.autocrlf=true` on Windows every
      checkout rewrites source to CRLF in the working tree (`git ls-files --eol`
      shows `i/lf w/crlf`). Repo blobs are all LF and CI (Linux) is green, but
      locally this makes `prettier --check` / `eslint` report false failures and
      `git add` warn on every file. Add `* text=auto eol=lf` (plus binary markers
      for images/icons/fonts) so Windows checkouts match the LF the repo and the
      pre-commit Prettier gate expect.

---

## ✅ CI / tooling

- [x] **AUD-21 — Free-tier code-coverage CI (replace the removed Code Quality
      gate).** The GitHub Code Quality coverage workflow was removed — it needs an
      org on Team/Enterprise and only 404'd on this personal repo. Replace it with
      a self-contained workflow that works on any free/personal repo:
      **generate** coverage, **fail** CI when it drops below a threshold, **show** a
      summary in the Actions run, and **upload** the HTML/XML report as an
      artifact. No external service or GitHub Enterprise needed. For the backend:
      ```
      pytest --cov=app --cov-report=term-missing \
             --cov-report=xml:coverage.xml \
             --cov-report=html:htmlcov \
             --cov-fail-under=70
      ```
      (re-add `pytest-cov` to `requirements.txt`), plus `actions/upload-artifact`
      for `htmlcov/` + `coverage.xml` and `>> $GITHUB_STEP_SUMMARY` for the summary.
      Mirror for the desktop with `vitest run --coverage` (re-add
      `@vitest/coverage-v8`, set `coverage.thresholds`, upload the report).
      Pick realistic `--cov-fail-under` per suite (backend already ~90%; desktop
      ~24% — set its floor low initially and raise as tests grow).
      _(Shipped 2026-07-08 on `ci/coverage-gate` (PR #57): added self-contained
      [`.github/workflows/coverage.yml`](.github/workflows/coverage.yml) —
      backend `pytest-cov` (`--cov-fail-under=80`) + desktop `vitest`
      coverage-v8 (`coverage.thresholds` lines/stmts 20, funcs 12, branches 10),
      each writing a `$GITHUB_STEP_SUMMARY` and uploading the html/xml report as
      an artifact. Re-added `pytest-cov`/`coverage` and `@vitest/coverage-v8`.
      Non-blocking for now (not a required ruleset check); the workflow header
      documents how to promote it. Both jobs verified green on the PR.)_
