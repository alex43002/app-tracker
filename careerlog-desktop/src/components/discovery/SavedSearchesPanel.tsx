import type { AlertCriteria, JobAlert } from "../../types/discovery";

function criteriaSummary(criteria: AlertCriteria): string {
  const parts = Object.entries(criteria).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(" · ") : "any posting";
}

type Props = {
  alertName: string;
  setAlertName: (v: string) => void;
  alerts: JobAlert[];
  onSave: () => void;
  onCheck: (alert: JobAlert) => void;
  onToggleNotify: (alert: JobAlert) => void;
  onDelete: (alert: JobAlert) => void;
};

/** "Save this search as an alert" input + the list of saved searches. */
export function SavedSearchesPanel({
  alertName,
  setAlertName,
  alerts,
  onSave,
  onCheck,
  onToggleNotify,
  onDelete,
}: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          Save this search as an alert:
        </span>
        <input
          value={alertName}
          onChange={(e) => setAlertName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          placeholder="e.g. Remote senior Python"
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={onSave}
          disabled={!alertName.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          Save search
        </button>
        <span className="text-xs text-gray-400">
          Get notified when new matching postings are imported.
        </span>
      </div>

      {alerts.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex flex-wrap items-center gap-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-800">{alert.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {criteriaSummary(alert.criteria)}
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={alert.notify}
                  onChange={() => onToggleNotify(alert)}
                />
                notify
              </label>
              <button
                onClick={() => onCheck(alert)}
                className="text-xs text-blue-600 hover:underline"
              >
                Check now
              </button>
              <button
                onClick={() => onDelete(alert)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
