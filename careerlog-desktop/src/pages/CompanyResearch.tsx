import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import {
  fetchCompanySnapshot,
  fetchResearchCompanies,
} from "../api/companyResearch";
import type {
  CompanyRef,
  CompanySnapshot,
  Facet,
} from "../types/companyResearch";

/* ============================================================
   Company research snapshots

   A snapshot assembled from the public postings we already ingest:
   open roles, locations, ATS platforms, seniority mix, salary range,
   and tech-stack clues. No scraping or AI — just what the company's
   own postings tell us.
============================================================ */

function money(n: number | null): string {
  return n == null ? "—" : `$${n.toLocaleString()}`;
}

export function CompanyResearch() {
  const [companies, setCompanies] = useState<CompanyRef[]>([]);
  const [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchResearchCompanies()
      .then(setCompanies)
      .catch(() => {
        /* the picker is optional; ignore */
      });
  }, []);

  async function loadSnapshot(company: string) {
    if (!company.trim()) return;
    setLoading(true);
    try {
      const snap = await fetchCompanySnapshot(company.trim());
      setSnapshot(snap);
    } catch {
      toast.error("Failed to load snapshot");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Company research</h1>
          <p className="text-sm text-gray-500">
            A snapshot built from a company's public postings: open roles,
            locations, ATS platforms, seniority, pay range, and tech-stack clues.
          </p>
        </div>

        {/* Picker */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-gray-700">Company</span>
            <input
              list="research-companies"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadSnapshot(query)}
              placeholder="Search a company…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <datalist id="research-companies">
              {companies.map((c) => (
                <option key={c.name} value={c.name} label={`${c.openRoles} roles`} />
              ))}
            </datalist>
          </label>
          <button
            onClick={() => loadSnapshot(query)}
            disabled={loading || !query.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? "Loading…" : "Research"}
          </button>
        </div>

        {snapshot && !snapshot.found && (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No postings ingested for <strong>{snapshot.company}</strong> yet.
            Import this company's board on the Discover tab first.
          </div>
        )}

        {snapshot && snapshot.found && (
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {snapshot.company}
              </h2>
              <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                <Stat label="Open roles" value={String(snapshot.openRoles)} />
                <Stat
                  label="Pay range"
                  value={
                    snapshot.salaryMin || snapshot.salaryMax
                      ? `${money(snapshot.salaryMin)} – ${money(snapshot.salaryMax)}`
                      : "—"
                  }
                />
                <Stat
                  label="ATS platforms"
                  value={snapshot.sources.join(", ") || "—"}
                />
                <Stat
                  label="Latest posting"
                  value={
                    snapshot.latestPostedAt
                      ? new Date(snapshot.latestPostedAt).toLocaleDateString()
                      : "—"
                  }
                />
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <FacetCard title="Tech-stack clues" facets={snapshot.topSkills} />
              <FacetCard title="Locations" facets={snapshot.locations} />
              <FacetCard
                title="Seniority mix"
                facets={snapshot.experienceLevels}
              />
              <FacetCard
                title="Work arrangement"
                facets={snapshot.workArrangements}
              />
            </div>

            {snapshot.sampleTitles.length > 0 && (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-2 font-semibold text-gray-900">
                  Sample open roles
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {snapshot.sampleTitles.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}

function FacetCard({ title, facets }: { title: string; facets: Facet[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
      {facets.length === 0 ? (
        <p className="text-sm text-gray-400">No data.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {facets.map((f) => (
            <li
              key={f.value}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
            >
              {f.value}
              <span className="ml-1 text-gray-400">{f.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
