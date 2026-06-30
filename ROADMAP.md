# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-06-30_

All tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, and **feature
(FEAT-\*)** roadmap items are complete, including the batch of product issues
found in manual testing (BUG-14/15/16, FEAT-17/18/19/20), plus the
**résumé ↔ job matching** epic (FEAT-21) and the **job discovery & aggregation**
epic (FEAT-22). This file lists the **work that is still open**.

---

## ⬜ Release prep (FEAT-8 follow-up)

The cross-platform build + tag-driven release workflow is wired, but a first
branded, signed release still needs:

- [x] Add a 1024×1024 `careerlog-desktop/assets/icon.png` (app icon). _(On-theme
      placeholder added; replace with final branding before a public release.)_
- [ ] Configure the signing / notarization secrets in GitHub Actions
      (per-OS: Windows code-signing cert, macOS Developer ID + notarization
      credentials). Builds succeed unsigned when these are absent. _(Manual —
      needs your certificates; secret names documented in
      [`careerlog-desktop/RELEASING.md`](careerlog-desktop/RELEASING.md).)_
- [ ] Cut the first cross-platform tagged release and verify auto-update.
      _(Manual / outward-facing — tag-push steps in
      [`careerlog-desktop/RELEASING.md`](careerlog-desktop/RELEASING.md). Note:
      the release workflow is nested under `careerlog-desktop/.github/` and must
      live at the repo root to trigger.)_

---

## ⬜ Improvements & fixes from manual testing (2026-06-30)

Follow-ups to the shipped **Match** (FEAT-21) and **Discover/Compare/Alerts**
(FEAT-22) work, found while exercising the desktop app end-to-end. _Same
constraint as below: no generative AI — classic NLP/ML is fine._

### Bugs

- [ ] **BUG-23 — Compare tab fails to load jobs (422).** The Compare tab requests
      `GET /api/jobs/?page=1&pageSize=200&...`, but the endpoint caps `pageSize`
      at `le=100` ([`app/jobs/routes.py`](backend-app-tracker/app/jobs/routes.py)),
      so the request is rejected with `VALIDATION_ERROR`. Fix by raising the cap
      (or removing it for this view) and/or having the desktop client page within
      the allowed bounds.
- [x] **BUG-24 — Discover employment-type filter returns 0 results.** Reproduced
      with the Stripe board token: filtering by `employmentType` returns nothing
      for every option, even though employment type is shown on the linked
      posting page. Audit ingestion/normalization so `employmentType` is reliably
      extracted and stored on `discovered_jobs`, and confirm the filter matches
      the normalized values.
- [ ] **BUG-25 — Filtering after ranking by fit drops the active filter set.** In
      the Discover tab, if you rank jobs by résumé fit and *then* apply a filter,
      the filter doesn't combine with all currently-active filters (including the
      current resume fit). Applying a filter must use the full set of active
      filters together with the selected resume fit, rather than resetting or
      ignoring the existing ranking/filter state.

### Discover tab

- [x] **FEAT-23 — Friendlier board-token discovery.** Board tokens are opaque:
      users don't know what they are, where to find them, or how to use them.
      Add a user-friendly way to locate/select the correct board token (e.g. a
      searchable company picker, "paste a careers URL and we extract the token"
      helper, and inline guidance/examples).
- [x] **FEAT-24 — Location filtering.** Let users narrow discovered jobs by
      city, state, remote status, or region.
- [x] **FEAT-25 — Broader ATS source coverage.** Add support for more ATS
      platforms beyond Greenhouse/Lever to improve discovery coverage across
      companies.
- [ ] **FEAT-30 — Guided city/state/region location filter.** The location
      filter (FEAT-24) currently takes free-form input, but job postings store
      specific location values (or none at all), so arbitrary user text rarely
      matches. Make the filter guided — e.g. suggest/autocomplete from the
      locations actually present in discovered jobs, normalize input, and handle
      postings with no location — so users select from valid options instead of
      guessing.

### Match tab

- [x] **FEAT-26 — Improve keyword coverage.** Keyword coverage in the Match tab
      needs significant improvement (still no AI — expand the
      taxonomy/extraction with classic NLP/ML).

### Alerts tab

- [x] **FEAT-27 — Distinguish pending vs. sent alerts.** Alerts scheduled for a
      future date/time should be visually marked as not-yet-sent, and alerts that
      have already fired should move into a separate **Sent Alerts** section.

---

## ⬜ Account & app experience

New work focused on the user's account and the desktop app itself (outside the
no-generative-AI matching/discovery constraint below).

- [ ] **FEAT-28 — Expanded profile settings.** Extend the profile settings so
      users can view and modify their basic user information (e.g. name, email,
      and other core account details) from within the app, with validation and
      persistence to the backend.
- [ ] **FEAT-29 — Automatic desktop app updates.** Make the desktop app
      auto-update from the latest published GitHub releases, similar to
      platforms like Discord: check for updates in the background, download new
      versions, and install them seamlessly (prompt or apply on next launch).
      Builds on the existing tag-driven release workflow (see _Release prep_
      above) and the auto-update verification step.

---

## ⬜ Proposed features (resume matching, job discovery & prep)

_Constraint: no generative AI. Classic ML (NLP, TF-IDF, embeddings, classic
classifiers, etc.) is acceptable for the matching/scoring work below._

### ✅ Resume ↔ job matching (FEAT-21 — shipped)

_Backend `app/matching` engine (extraction, keyword/skill taxonomy, scoring,
SSRF-guarded URL scrape) + the desktop **Match** tab._

- [x] Scan uploaded resumes from a job record for keywords (No AI; ML OK).
- [x] Scrape a designated job URL for the most relevant skills/keywords
      (No AI; ML OK).
- [x] Compare a resume to a job posting and produce a detailed score based on
      keyword matching and other metrics estimating interview likelihood
      (No AI; ML OK).
- [x] New dedicated tab for the above so job seekers can see their score before
      submitting.
- [x] Resume-to-job gap analysis.

### ✅ Job discovery & aggregation (FEAT-22 — shipped)

- [x] Unified job discovery + resume-matching tab: collects public job postings
      in the backend from supported company career pages / ATS systems,
      normalizes them into one searchable format, and lets users filter or rank
      jobs by salary, location, employment type, company, ATS source, and
      resume fit. _(FEAT-22: Greenhouse/Lever ingestion + the Discover tab with
      résumé-fit ranking that reuses FEAT-21.)_
- [x] Duplicate detection that merges repeated postings across different job
      boards and ATS sources into one clean listing.
- [x] Saved searches and job alerts that notify users when new roles match their
      preferred title, salary, location, and work arrangement. _(FEAT-22: saved
      discovery searches + background notifications on newly-ingested matches.)_
- [x] Job posting quality checks that flag unclear, misleading, underpaid, or
      potentially low-quality opportunities.
- [x] Eligibility filters that help users identify jobs matching their degree
      status, work authorization, and experience level. _(FEAT-22: degree
      status, experience level, and work-authorization/sponsorship + clearance.)_
- [x] Side-by-side comparison view to evaluate multiple jobs by compensation,
      fit, location, requirements, and application status. _(FEAT-22: Compare
      tab over tracked jobs.)_
- [x] Posting freshness tracking to help users avoid stale, repeatedly reposted,
      or low-signal listings.
- [x] Company preference controls to prioritize target employers and hide
      companies or job types users want to avoid. _(FEAT-22: per-user
      preferred/hidden companies + hidden job types, applied in Discover.)_

### ⬜ Interview & research prep

- [ ] Interview preparation workspace that turns a job description into
      role-specific prep notes, likely topics, and practice questions.
- [ ] Company research snapshots covering: what the company does, industry,
      size, location, hiring trends, tech-stack clues, recent news,
      Glassdoor-style notes (if integrated legally), and known ATS platform.
- [ ] STAR story library to organize reusable interview stories for behavioral
      questions.
- [ ] Offer comparison tool to evaluate compensation, benefits, flexibility, and
      long-term fit.

### ⬜ Tracking & integrations

- [ ] Browser extension to save jobs from any supported career page directly
      into the application tracker.
- [ ] Email-based application tracking that automatically detects confirmations,
      interviews, rejections, and recruiter messages.
- [ ] Source performance analytics showing which job boards, recruiters, and
      referral channels produce the best results.
