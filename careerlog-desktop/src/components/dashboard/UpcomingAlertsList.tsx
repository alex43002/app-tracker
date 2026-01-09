import type { Alert } from "../../types/alert";

export function UpcomingAlertsList({
  alerts,
}: {
  alerts: Alert[];
}) {
  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <div className="border-b px-5 py-3 font-medium">
        Upcoming Alerts
      </div>

      {alerts.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-500">
          No upcoming alerts.
        </div>
      ) : (
        <ul className="divide-y text-sm">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="px-5 py-4 hover:bg-gray-50"
            >
              <div className="font-medium">
                {alert.message}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {new Date(
                  alert.scheduledAlert
                ).toLocaleString()}{" "}
                •{" "}
                {alert.smsOrEmail.toUpperCase()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
