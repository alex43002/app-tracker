import type {
  DiscoveryFilters as Filters,
  Preferences,
} from "../../types/discovery";

type Props = {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  prefs: Preferences | null;
  showPrefs: boolean;
  setShowPrefs: (fn: (s: boolean) => boolean) => void;
  newPreferred: string;
  setNewPreferred: (v: string) => void;
  newHidden: string;
  setNewHidden: (v: string) => void;
  savePrefs: (patch: Partial<Preferences>) => void;
};

/** Preference toggles (apply/preferred-only) + the expandable preference editor. */
export function PreferencesPanel({
  filters,
  setFilter,
  prefs,
  showPrefs,
  setShowPrefs,
  newPreferred,
  setNewPreferred,
  newHidden,
  setNewHidden,
  savePrefs,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={filters.applyPreferences ?? false}
            onChange={(e) => setFilter("applyPreferences", e.target.checked)}
          />
          Apply my preferences (hide avoided companies/types)
        </label>
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={filters.preferredOnly ?? false}
            onChange={(e) => setFilter("preferredOnly", e.target.checked)}
          />
          Preferred employers only
        </label>
        <button
          onClick={() => setShowPrefs((s) => !s)}
          className="ml-auto text-blue-600 hover:underline"
        >
          {showPrefs ? "Hide" : "Manage"} preferences
        </button>
      </div>

      {showPrefs && prefs && (
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <PreferenceList
            title="Preferred employers"
            items={prefs.preferredCompanies}
            value={newPreferred}
            onChange={setNewPreferred}
            onAdd={() => {
              if (!newPreferred.trim()) return;
              savePrefs({
                preferredCompanies: [
                  ...prefs.preferredCompanies,
                  newPreferred.trim(),
                ],
              });
              setNewPreferred("");
            }}
            onRemove={(c) =>
              savePrefs({
                preferredCompanies: prefs.preferredCompanies.filter(
                  (x) => x !== c,
                ),
              })
            }
          />
          <PreferenceList
            title="Hidden companies"
            items={prefs.hiddenCompanies}
            value={newHidden}
            onChange={setNewHidden}
            onAdd={() => {
              if (!newHidden.trim()) return;
              savePrefs({
                hiddenCompanies: [...prefs.hiddenCompanies, newHidden.trim()],
              });
              setNewHidden("");
            }}
            onRemove={(c) =>
              savePrefs({
                hiddenCompanies: prefs.hiddenCompanies.filter((x) => x !== c),
              })
            }
          />
        </div>
      )}
    </>
  );
}

function PreferenceList({
  title,
  items,
  value,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (item: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="mb-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="Company name"
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={onAdd}
          className="rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900"
        >
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">None yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
            >
              {item}
              <button
                onClick={() => onRemove(item)}
                className="text-gray-500 hover:text-red-600"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
