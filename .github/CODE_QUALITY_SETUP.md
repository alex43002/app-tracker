# Branch-protection ruleset — providers

The `main` branch ruleset ("Default", active) gates PRs. Its rules and the CI
that satisfies them:

| Rule | Provider | Status |
| --- | --- | --- |
| Required status check: `pre-commit` | [`pre-commit.yml`](workflows/pre-commit.yml) — ruff (+C901), Prettier, tsc, eslint, hygiene | ✅ |
| `code_scanning` (CodeQL) | CodeQL **default setup** (Settings → Code security) | ✅ |
| `deletion`, `non_fast_forward` | built-in | ✅ |

Both required signals work on a personal repo, so PRs merge normally when
`pre-commit` and CodeQL pass — no bypass needed.

## Why `code_quality` / `code_coverage` are not enforced

The ruleset originally also required `code_quality` and `code_coverage`. Those are
powered by **GitHub Code Quality**, which is only available to **organizations on
Team/Enterprise plans** — it is *not available on personal (user-owned) repos*
(public preview, GA 2026-07-20). `alex43002/app-tracker` is a personal repo, so
there is no "Code quality" toggle in Settings and the rules could never be
satisfied. They were removed from the ruleset on 2026-07-07.

## Coverage is still measured (best-effort)

[`code-coverage.yml`](workflows/code-coverage.yml) still runs the backend
(`pytest --cov`) and desktop (`vitest --coverage`) suites on every PR and emits
Cobertura XML. It *attempts* to upload to GitHub Code Quality, but that endpoint
404s on a personal repo, so those upload steps fail (`fail-on-error: true` — the
failure is surfaced, not hidden). The coverage jobs therefore show **red**, but
that is **non-blocking**: `code_coverage` is not a required ruleset check, so it
doesn't stop merges. Measured 2026-07-07: backend **90%**, desktop **~24%**,
aggregate **~63%**.

## If you ever move this repo into an org (Team/Enterprise)

To turn the coverage/quality gates back on:

1. Transfer the repo into the org and enable **Settings → Code quality**. The
   uploads (already `fail-on-error: true`) then succeed and the jobs go green.
2. Re-add the `code_quality` and `code_coverage` rules to the "Default" ruleset,
   then run the Code Coverage workflow once on `main` to set the baseline.
