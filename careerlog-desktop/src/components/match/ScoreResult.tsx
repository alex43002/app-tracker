import type { MatchScore } from "../../types/match";

/* ============================================================
   Match score result (FEAT-21)

   Renders the 0–100 score, the per-signal coverage, and the
   matched terms + gaps so the seeker sees both the number and
   *why* — the gap list is the actionable part.
============================================================ */

/** Tailwind color band for a 0–100 score. */
function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 75)
    return { ring: "ring-green-500", text: "text-green-700", label: "Strong match" };
  if (score >= 50)
    return { ring: "ring-amber-500", text: "text-amber-700", label: "Partial match" };
  return { ring: "ring-red-500", text: "text-red-700", label: "Weak match" };
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Chips({
  terms,
  tone,
  emptyText,
}: {
  terms: string[];
  tone: "match" | "gap" | "neutral";
  emptyText: string;
}) {
  if (terms.length === 0)
    return <p className="text-xs text-gray-400">{emptyText}</p>;

  const styles =
    tone === "match"
      ? "bg-green-100 text-green-800"
      : tone === "gap"
        ? "bg-red-100 text-red-800"
        : "bg-gray-100 text-gray-700";

  return (
    <div className="flex flex-wrap gap-1.5">
      {terms.map((t) => (
        <span
          key={t}
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function ScoreResult({ result }: { result: MatchScore }) {
  const tone = scoreTone(result.score);
  const { breakdown } = result;

  return (
    <div className="flex flex-col gap-6">
      {/* Headline score */}
      <div className="flex items-center gap-5">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white ring-4 ${tone.ring}`}
        >
          <span className={`text-3xl font-bold ${tone.text}`}>
            {result.score}
          </span>
        </div>
        <div>
          <p className={`text-lg font-semibold ${tone.text}`}>{tone.label}</p>
          <p className="text-sm text-gray-500">
            Estimated résumé fit for this posting, based on keyword and skill
            coverage.
          </p>
        </div>
      </div>

      {/* Coverage breakdown */}
      <div className="grid gap-3 sm:grid-cols-2">
        <CoverageBar label="Skill coverage" value={breakdown.skillCoverage} />
        <CoverageBar label="Keyword coverage" value={breakdown.keywordCoverage} />
      </div>

      {/* Gap analysis — the actionable part */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-amber-900">
          Gaps to address ({result.gaps.length})
        </h3>
        <Chips
          terms={result.gaps}
          tone="gap"
          emptyText="No gaps — your résumé covers everything the posting asks for."
        />
      </section>

      {/* Matched terms */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Matched skills ({breakdown.matchedSkills.length})
          </h3>
          <Chips
            terms={breakdown.matchedSkills}
            tone="match"
            emptyText="No skills from the posting were found in your résumé."
          />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Missing skills ({breakdown.missingSkills.length})
          </h3>
          <Chips
            terms={breakdown.missingSkills}
            tone="gap"
            emptyText="None — all required skills are covered."
          />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Matched keywords ({breakdown.matchedKeywords.length})
          </h3>
          <Chips
            terms={breakdown.matchedKeywords}
            tone="neutral"
            emptyText="No overlapping keywords."
          />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Missing keywords ({breakdown.missingKeywords.length})
          </h3>
          <Chips
            terms={breakdown.missingKeywords}
            tone="neutral"
            emptyText="None."
          />
        </section>
      </div>
    </div>
  );
}
