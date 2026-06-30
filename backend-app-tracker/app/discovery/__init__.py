"""Job discovery & aggregation (FEAT-22).

Collects public job postings from supported ATS systems (Greenhouse, Lever, …),
normalizes them into a single searchable shape, and stores them in a shared
``discovered_jobs`` collection that any authenticated user can search and filter.

Only public, documented ATS JSON endpoints are used — no HTML scraping of
career pages and nothing behind authentication. Each connector turns a company's
public board into a list of normalized postings; the service upserts them
(deduped per source by the ATS posting id) and serves filtered/sorted queries.

This is the foundation epic; dedup across sources, freshness/quality scoring,
the discovery UI, and resume-fit ranking build on top of it.
"""
