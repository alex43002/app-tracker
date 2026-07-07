import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import {
  createOffer,
  deleteOffer,
  fetchOffers,
  updateOffer,
} from "../api/offers";
import { confirm } from "../components/common/dialogs/confirmController";
import { OFFER_STATUSES, type Offer, type OfferInput } from "../types/offer";

/* ============================================================
   Offer comparison tool

   Capture competing offers and evaluate them side by side on
   compensation, benefits, flexibility, and long-term fit. An overall
   score blends normalized total comp with the 1-5 ratings.
============================================================ */

const EMPTY: OfferInput = {
  company: "",
  role: "",
  location: "",
  baseSalary: null,
  bonus: null,
  equityPerYear: null,
  signOnBonus: null,
  benefitsRating: null,
  flexibilityRating: null,
  fitRating: null,
  notes: "",
  status: "received",
};

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

function rating(n: number | null | undefined): string {
  return n == null ? "—" : `${n}/5`;
}

// Blend normalized total comp (vs. the best offer) with the average rating.
function overallScore(offer: Offer, maxComp: number): number {
  const compScore = maxComp > 0 ? offer.totalComp / maxComp : 0;
  const ratings = [
    offer.benefitsRating,
    offer.flexibilityRating,
    offer.fitRating,
  ].filter((r): r is number => r != null);
  const ratingScore = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length / 5
    : 0;
  return Math.round((0.5 * compScore + 0.5 * ratingScore) * 100);
}

export function Offers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOffers()
      .then(setOffers)
      .catch(() => toast.error("Failed to load offers"))
      .finally(() => setLoading(false));
  }, []);

  const maxComp = useMemo(
    () => offers.reduce((m, o) => Math.max(m, o.totalComp), 0),
    [offers],
  );
  const scores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of offers) map[o.id] = overallScore(o, maxComp);
    return map;
  }, [offers, maxComp]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function startEdit(o: Offer) {
    setEditingId(o.id);
    setForm({
      company: o.company,
      role: o.role,
      location: o.location,
      baseSalary: o.baseSalary,
      bonus: o.bonus,
      equityPerYear: o.equityPerYear,
      signOnBonus: o.signOnBonus,
      benefitsRating: o.benefitsRating,
      flexibilityRating: o.flexibilityRating,
      fitRating: o.fitRating,
      notes: o.notes,
      status: o.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      toast.error("Company and role are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateOffer(editingId, form);
        setOffers((prev) =>
          prev.map((o) => (o.id === editingId ? updated : o)),
        );
        toast.success("Offer updated");
      } else {
        const created = await createOffer(form);
        setOffers((prev) => [created, ...prev]);
        toast.success("Offer added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save offer");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(o: Offer) {
    const ok = await confirm({
      title: "Delete offer",
      description: `Delete the ${o.company} offer? This can't be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteOffer(o.id);
      setOffers((prev) => prev.filter((x) => x.id !== o.id));
      if (editingId === o.id) resetForm();
      toast.success("Offer deleted");
    } catch {
      toast.error("Failed to delete offer");
    }
  }

  const bestScore = Math.max(0, ...Object.values(scores));

  const numField = (
    key: keyof OfferInput,
    label: string,
    opts?: { min?: number; max?: number; step?: number },
  ) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min={opts?.min ?? 0}
        max={opts?.max}
        step={opts?.step ?? 1000}
        value={(form[key] as number | null) ?? ""}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: e.target.value === "" ? null : Number(e.target.value),
          }))
        }
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );

  const compareRows: {
    label: string;
    render: (o: Offer) => string;
    best?: (o: Offer) => number;
  }[] = [
    { label: "Status", render: (o) => o.status },
    { label: "Location", render: (o) => o.location || "—" },
    {
      label: "Base salary",
      render: (o) => money(o.baseSalary),
      best: (o) => o.baseSalary ?? -1,
    },
    {
      label: "Bonus",
      render: (o) => money(o.bonus),
      best: (o) => o.bonus ?? -1,
    },
    {
      label: "Equity / yr",
      render: (o) => money(o.equityPerYear),
      best: (o) => o.equityPerYear ?? -1,
    },
    {
      label: "Sign-on",
      render: (o) => money(o.signOnBonus),
      best: (o) => o.signOnBonus ?? -1,
    },
    {
      label: "Total comp / yr",
      render: (o) => money(o.totalComp),
      best: (o) => o.totalComp,
    },
    {
      label: "Benefits",
      render: (o) => rating(o.benefitsRating),
      best: (o) => o.benefitsRating ?? -1,
    },
    {
      label: "Flexibility",
      render: (o) => rating(o.flexibilityRating),
      best: (o) => o.flexibilityRating ?? -1,
    },
    {
      label: "Long-term fit",
      render: (o) => rating(o.fitRating),
      best: (o) => o.fitRating ?? -1,
    },
  ];

  // The highest value per "best" row, so we can highlight the winner.
  function rowMax(best: (o: Offer) => number): number {
    return Math.max(...offers.map(best));
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Offers</h1>
          <p className="text-sm text-gray-500">
            Capture competing offers and compare them on compensation, benefits,
            flexibility, and long-term fit.
          </p>
        </div>

        {/* Editor */}
        <form
          onSubmit={handleSave}
          className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <h2 className="font-semibold text-gray-900 sm:col-span-2 lg:col-span-3">
            {editingId ? "Edit offer" : "Add an offer"}
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Company
            </span>
            <input
              value={form.company}
              onChange={(e) =>
                setForm((f) => ({ ...f, company: e.target.value }))
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Role</span>
            <input
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Location
            </span>
            <input
              value={form.location ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          {numField("baseSalary", "Base salary")}
          {numField("bonus", "Bonus")}
          {numField("equityPerYear", "Equity / yr")}
          {numField("signOnBonus", "Sign-on bonus")}
          {numField("benefitsRating", "Benefits (1-5)", {
            min: 1,
            max: 5,
            step: 1,
          })}
          {numField("flexibilityRating", "Flexibility (1-5)", {
            min: 1,
            max: 5,
            step: 1,
          })}
          {numField("fitRating", "Long-term fit (1-5)", {
            min: 1,
            max: 5,
            step: 1,
          })}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {OFFER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block font-medium text-gray-700">Notes</span>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add offer"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-500 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Comparison */}
        {loading ? (
          <div className="rounded border p-6 text-sm text-gray-500">
            Loading…
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            Add a couple of offers above to compare them side by side.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="w-40 px-4 py-3 text-left font-medium text-gray-500">
                    Metric
                  </th>
                  {offers.map((o) => (
                    <th
                      key={o.id}
                      className="min-w-[12rem] px-4 py-3 text-left font-semibold"
                    >
                      {o.company}
                      <span className="block text-xs font-normal text-gray-500">
                        {o.role}
                      </span>
                      <span className="mt-1 flex gap-2 text-xs font-normal">
                        <button
                          onClick={() => startEdit(o)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(o)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => {
                  const max = row.best ? rowMax(row.best) : null;
                  return (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-500">
                        {row.label}
                      </td>
                      {offers.map((o) => {
                        const isBest =
                          row.best != null &&
                          max != null &&
                          max > 0 &&
                          row.best(o) === max &&
                          offers.length > 1;
                        return (
                          <td
                            key={o.id}
                            className={`px-4 py-2.5 ${
                              isBest
                                ? "font-semibold text-green-700"
                                : "text-gray-700"
                            }`}
                          >
                            {row.render(o)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Overall score */}
                <tr className="border-t-2 bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-700">
                    Overall score
                  </td>
                  {offers.map((o) => {
                    const isBest =
                      scores[o.id] === bestScore && offers.length > 1;
                    return (
                      <td
                        key={o.id}
                        className={`px-4 py-3 ${
                          isBest
                            ? "font-bold text-green-700"
                            : "font-medium text-gray-700"
                        }`}
                      >
                        {scores[o.id]}
                        {isBest && <span className="ml-1 text-xs">★ best</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-gray-400">
              Overall score blends total comp (vs. your best offer) and the
              average of your benefits, flexibility, and fit ratings.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
