# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-06-26_

All tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, and **feature (FEAT-\*)**
roadmap items are complete (backend **73 tests + ruff clean**; desktop **48 tests
+ typecheck + eslint clean**). This file now lists **only the work that is still
open** — everything below is ops/release-prep or optional future scaling, not
application code.

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
