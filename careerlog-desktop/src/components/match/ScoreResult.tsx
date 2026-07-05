import type { MatchScore, MatchStatus, TermMatch } from "../../types/match";
import { scoreVerdict, type ScoreBand } from "../../lib/matchReport";

/* ============================================================
   Match score result (FEAT-21)

   Renders the 0–100 score plus *why*: parse confidence, the
   detected role family, per-section coverage (required /
   responsibility / preferred, with an honest N/A for the
   curated-skill signal), the strengths with the résumé evidence
   that earned them, and the prioritized gaps.
============================================================ */

const BAND_CLASSES: Record<ScoreBand, { ring: string; text: string }> = {
  strong: { ring: "ring-green-500", text: "text-green-700" },
  partial: { ring: "ring-amber-500", text: "text-amber-700" },
  weak: { ring: "ring-red-500", text: "text-red-700" },
};

const CONFIDENCE_CLASSES: Record<MatchScore["confidence"], string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-200 text-gray-700",
};

const STATUS_CLASSES: Record<MatchStatus, string> = {
  strong: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  foundational: "bg-sky-100 text-sky-800",
  missing: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  strong: "Strong",
  partial: "Partial",
  foundational: "Foundational",
  missing: "Missing",
};

function pctText(value: number | null): string {
  return value === null ? "N/A" : `${Math.round(value * 100)}%`;
}

function CoverageBar({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{pctText(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        {value !== null && (
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

function StrengthRow({ match }: { match: TermMatch }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-gray-100 py-1.5 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_CLASSES[match.status]}`}
        >
          {STATUS_LABEL[match.status]}
        </span>
        <span className="text-sm font-medium text-gray-800">{match.term}</span>
      </div>
      {match.evidence.length > 0 && (
        <span className="pl-1 text-xs text-gray-500">
          via {match.evidence.slice(0, 4).join(", ")}
        </span>
      )}
    </li>
  );
}

export function ScoreResult({ result }: { result: MatchScore }) {
  const tone = scoreVerdict(result.score);
  const band = BAND_CLASSES[tone.band];
  const { coverage } = result;

  const requiredGaps = result.gaps.filter((g) => g.bucket === "required");
  const otherGaps = result.gaps.filter((g) => g.bucket !== "required");

  return (
    <div className="flex flex-col gap-6">
      {/* Headline score */}
      <div className="flex items-center gap-5">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white ring-4 ${band.ring}`}
        >
          <span className={`text-3xl font-bold ${band.text}`}>{result.score}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className={`text-lg font-semibold ${band.text}`}>{tone.label}</p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_CLASSES[result.confidence]}`}
            >
              {result.confidence} confidence
            </span>
          </div>
          {result.roleFamilies.length > 0 && (
            <p className="text-xs text-gray-500">
              Read as: {result.roleFamilies.join(" · ")}
            </p>
          )}
          <p className="text-sm text-gray-500">{result.confidenceReason}</p>
        </div>
      </div>

      {/* Coverage breakdown */}
      <div className="grid gap-3 sm:grid-cols-2">
        <CoverageBar label="Required" value={coverage.required} />
        <CoverageBar label="Responsibilities" value={coverage.responsibility} />
        <CoverageBar label="Preferred" value={coverage.preferred} />
        <CoverageBar label="Recognized skills" value={coverage.concept} />
      </div>
      {!result.skillSignalAvailable && (
        <p className="-mt-3 text-xs text-gray-500">
          No curated skills were recognized for this field, so matching used
          salient terms from the posting. The recognized-skills bar is N/A.
        </p>
      )}

      {/* Gaps — the actionable part */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-amber-900">
          Gaps to address ({result.gaps.length})
        </h3>
        {result.gaps.length === 0 ? (
          <p className="text-xs text-gray-500">
            No gaps — your résumé covers what the posting asks for.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {requiredGaps.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-amber-900">
                  Required, and missing:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {requiredGaps.map((g) => (
                    <span
                      key={g.term}
                      className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                    >
                      {g.term}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {otherGaps.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {otherGaps.slice(0, 20).map((g) => (
                  <span
                    key={g.term}
                    className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                  >
                    {g.term}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Strengths with evidence */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          What you match ({result.strengths.length})
        </h3>
        {result.strengths.length === 0 ? (
          <p className="text-xs text-gray-400">
            Nothing from the posting was found in your résumé.
          </p>
        ) : (
          <ul className="flex flex-col">
            {result.strengths.slice(0, 14).map((m) => (
              <StrengthRow key={`${m.term}-${m.status}`} match={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
