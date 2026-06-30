# CareerLog — Product Roadmap (Remaining Work)

_Last updated: 2026-06-29_

All tracked **security (SEC-\*)**, **cleanup (CLN-\*)**, and **feature
(FEAT-\*)** roadmap items are complete, including the batch of product issues
found in manual testing (BUG-14/15/16, FEAT-17/18/19/20). This file lists the
**work that is still open**.

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

## ⬜ Proposed features (resume matching, job discovery & prep)

_Constraint: no generative AI. Classic ML (NLP, TF-IDF, embeddings, classic
classifiers, etc.) is acceptable for the matching/scoring work below._

### Resume ↔ job matching

_Shipped in FEAT-21: backend `app/matching` engine (extraction, keyword/skill
taxonomy, scoring, SSRF-guarded URL scrape) + the desktop **Match** tab._

- [x] Scan uploaded resumes from a job record for keywords (No AI; ML OK).
- [x] Scrape a designated job URL for the most relevant skills/keywords
      (No AI; ML OK).
- [x] Compare a resume to a job posting and produce a detailed score based on
      keyword matching and other metrics estimating interview likelihood
      (No AI; ML OK).
- [x] New dedicated tab for the above so job seekers can see their score before
      submitting.
- [x] Resume-to-job gap analysis.

### Job discovery

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

### Interview & research prep

- [ ] Interview preparation workspace that turns a job description into
      role-specific prep notes, likely topics, and practice questions.
- [ ] Company research snapshots covering: what the company does, industry,
      size, location, hiring trends, tech-stack clues, recent news,
      Glassdoor-style notes (if integrated legally), and known ATS platform.
- [ ] STAR story library to organize reusable interview stories for behavioral
      questions.
- [ ] Offer comparison tool to evaluate compensation, benefits, flexibility, and
      long-term fit.

### Tracking & integrations

- [ ] Browser extension to save jobs from any supported career page directly
      into the application tracker.
- [ ] Email-based application tracking that automatically detects confirmations,
      interviews, rejections, and recruiter messages.
- [ ] Source performance analytics showing which job boards, recruiters, and
      referral channels produce the best results.
