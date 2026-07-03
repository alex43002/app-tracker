# Build resources (`buildResources`)

electron-builder reads packaging resources from this directory (see
`build.directories.buildResources` in `package.json`).

## App icons (required for branded installers)

A single high-resolution **square** source icon drives electron-builder's
per-platform formats:

- `assets/icon.png` — **1024×1024** (used for Linux directly; macOS/Windows
  icons are generated from it). ✅ **present** (currently an on-theme
  placeholder — replace with final branding before a public release).

Optionally provide platform-specific icons instead:

- `assets/icon.icns` — macOS
- `assets/icon.ico` — Windows (256×256 multi-size)

> The repo's `careerlog.png` (1183×789) is **not square**, so it can't be used
> as the source icon. The current `icon.png` is a 1024×1024 placeholder; swap in
> final branding (same dimensions) before cutting a branded release.

## Code signing

`entitlements.mac.plist` is the hardened-runtime entitlements file used for
macOS signing + notarization. Signing certificates and credentials are supplied
via environment variables / CI secrets — see the desktop `README.md`
("Building & Releasing").
