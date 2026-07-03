# CareerLog Job Saver (browser extension)

A small Manifest V3 browser extension that saves the job posting on the current
tab straight into your CareerLog tracker, from any supported career page.

It reuses the existing backend API — no server changes:

- `POST /api/auth/login` to obtain a bearer token (stored in
  `chrome.storage.local`).
- `POST /api/jobs` to create the job.

## How it works

1. The popup signs you in and remembers your API URL + token.
2. When opened on a job page, it scrapes the **title**, **company**, and
   **location** — preferring a [JSON-LD `JobPosting`](https://schema.org/JobPosting)
   block, then falling back to Open Graph / `<title>` metadata.
3. You review/edit the fields, pick a status, and click **Save to CareerLog**.

Everything stays editable, so it works even on pages it can't fully parse.

## Loading it (Chrome / Edge)

1. Run the backend locally (default `http://localhost:8000`).
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select this `browser-extension/` folder.
4. Open a job posting, click the CareerLog icon, sign in, and save.

(For Firefox, load `manifest.json` via `about:debugging` → *This Firefox* →
*Load Temporary Add-on*.)

## Notes

- `host_permissions` cover `http://*/*` and `https://*/*` so the popup can both
  scrape the active tab and reach your API host. The API calls use a bearer
  token (no cookies), so they aren't subject to the backend's CORS allowlist.
- The API URL field defaults to `http://localhost:8000`; point it at your
  deployed backend in production.
- Saved jobs default `salaryTarget` to `0` — edit them in the app afterwards if
  you want to set a target.
