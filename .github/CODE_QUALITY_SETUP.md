# Branch-protection ruleset — provider setup

The `main` branch ruleset ("Default", active, no bypass actors) enforces six
rules. Four need a signal from CI/GitHub; this repo now wires up all of them, but
**two require a one-time action in repo Settings that can't be done from the CLI**
(there is no REST API for GitHub Code Quality yet).

| Ruleset rule | Provider | Status |
| --- | --- | --- |
| Required status check: `pre-commit` | [`pre-commit.yml`](workflows/pre-commit.yml) | ✅ working |
| `code_scanning` (CodeQL) | CodeQL **default setup** | ⚙️ enable in Settings / API |
| `code_coverage` (≥50%, ≤5% drop) | [`code-coverage.yml`](workflows/code-coverage.yml) → GitHub Code Quality | ⚙️ needs Code Quality enabled |
| `code_quality` (severity: errors) | GitHub **Code Quality** | ⚙️ enable in Settings (UI only) |
| `deletion`, `non_fast_forward` | built-in | ✅ |

## What you need to do (once)

### 1. Enable GitHub Code Quality — **required for `code_quality` and `code_coverage`**

Settings → **Security → Code quality → Enable code quality** → pick languages
(Python + JavaScript/TypeScript) → Save.

This produces the **"CodeQL - Code Quality"** check (satisfies `code_quality`) and
turns on the coverage ingestion that [`code-coverage.yml`](workflows/code-coverage.yml)
uploads to. There is **no REST API** for this (it's in public preview, GA
2026-07-20), so it must be done in the UI. Until it's on, the coverage upload
step fails.

### 2. Enable CodeQL code scanning — for `code_scanning`

Either Settings → **Security → Code scanning → Set up → Default**, or via API:

```bash
gh api -X PATCH repos/alex43002/app-tracker/code-scanning/default-setup \
  -f state=configured
```

### 3. Land this PR past the ruleset (bootstrap)

This PR is blocked by the very ruleset it configures (the required checks don't
exist on `main` yet, and there's no coverage baseline). Break the cycle **once**:

- **Recommended:** Settings → Rules → **"Default"** → set **Enforcement:
  Evaluate** (or **Disabled**), merge this PR, then set it back to **Active**. The
  first push to `main` then establishes the CodeQL results + coverage baseline, so
  every later PR is gated normally.
- Or add yourself to the ruleset's **Bypass list**, merge, remove.

After the first merge to `main`, subsequent PRs will have all four checks and can
merge without any bypass.

## Coverage reality (measured 2026-07-07)

`code_coverage` gates the **aggregate** across uploads, not per-language:

| Suite | Coverage | Statements |
| --- | --- | --- |
| Backend (pytest) | **90%** | 3040 / 3379 |
| Desktop (vitest, all files) | **~24%** | 535 / 2259 |
| **Aggregate** | **~63%** | 3575 / 5638 |

~63% clears the 50% floor, so the rule should pass today — but the desktop share
is low (many pages have no tests). Keep growing desktop tests, and watch the
`max_coverage_drop: 5` rule (a PR that removes tests can trip it).
