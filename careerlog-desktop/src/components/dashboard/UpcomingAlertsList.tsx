import type { Alert } from "../../types/alert";

export function UpcomingAlertsList({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="rounded border">
      <div className="border-b px-4 py-2 font-medium">
        Upcoming Alerts
      </div>

      <ul className="divide-y text-sm">
        {alerts.map(alert => (
          <li key={alert.id} className="px-4 py-3">
            <div className="font-medium">{alert.message}</div>
            <div className="text-xs text-gray-600">
              {new Date(alert.scheduledAlert).toLocaleString()} •{" "}
              {alert.smsOrEmail.toUpperCase()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
