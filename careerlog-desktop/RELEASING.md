# Releasing CareerLog Desktop

The cross-platform build + publish is wired in
[`.github/workflows/release.yml`](.github/workflows/release.yml): pushing a tag
like `v0.1.4` (or running the workflow manually) builds installers on macOS,
Windows, and Linux with `electron-builder` and publishes them to the matching
GitHub Release. The desktop app then auto-updates from those releases (FEAT-29).

This document tracks the remaining **manual** steps to cut a first *branded,
signed* release — the parts that need real assets/credentials and can't be done
in code.

## 1. App icon ✅

`assets/icon.png` (1024×1024) is in place — electron-builder generates the
per-platform icons from it. It's currently an on-theme **placeholder**; replace
it with final branding before a public release (keep it 1024×1024 and square).

## 2. Signing & notarization secrets (manual — needs your certificates)

Builds succeed **unsigned** when these are absent, so CI works for testing
without them. For a trusted, installable release, add these repository secrets
(Settings → Secrets and variables → Actions):

| Secret | Purpose |
| --- | --- |
| `WIN_CSC_LINK` | Base64 of the Windows code-signing `.pfx` |
| `WIN_CSC_KEY_PASSWORD` | Password for the Windows cert |
| `MAC_CSC_LINK` | Base64 of the macOS Developer ID `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password for the macOS cert |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

`GH_TOKEN` uses the built-in `GITHUB_TOKEN`, so no extra secret is needed to
publish to Releases.

## 3. Cut the first tagged release (manual — outward-facing)

```bash
# bump version in package.json first, then:
git tag v0.1.4
git push origin v0.1.4
```

Then verify on the published Release:

1. Installers for all three OSes are attached.
2. Install an older version, publish a newer tag, and confirm the in-app
   **"Restart to update"** prompt appears and applies the update (FEAT-29).

## ⚠️ Workflow location

GitHub Actions only runs workflows from **`.github/workflows/` at the repository
root**. This workflow currently lives at
`careerlog-desktop/.github/workflows/release.yml`. If the repository root is the
monorepo root (`app-tracker/`), move it to `app-tracker/.github/workflows/`
(it already sets `working-directory: careerlog-desktop`, so no other change is
needed) or it won't trigger on tag pushes.
