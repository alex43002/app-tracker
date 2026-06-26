# Build resources (`buildResources`)

electron-builder reads packaging resources from this directory (see
`build.directories.buildResources` in `package.json`).

## App icons (required for branded installers)

Add a single high-resolution **square** source icon and electron-builder will
generate the per-platform formats:

- `assets/icon.png` — **1024×1024** (used for Linux directly; macOS/Windows
  icons are generated from it).

Optionally provide platform-specific icons instead:

- `assets/icon.icns` — macOS
- `assets/icon.ico` — Windows (256×256 multi-size)

> The repo's `careerlog.png` (1183×789) is **not square**, so it can't be used
> as-is. Export a 1024×1024 PNG before cutting a branded release. Without an
> icon, builds fall back to the default Electron icon.

## Code signing

`entitlements.mac.plist` is the hardened-runtime entitlements file used for
macOS signing + notarization. Signing certificates and credentials are supplied
via environment variables / CI secrets — see the desktop `README.md`
("Building & Releasing").
