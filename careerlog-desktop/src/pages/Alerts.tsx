import { AppLayout } from "../layouts/AppLayout";

type Alert = {
  id: string;
  scheduledAt: string;
  channel: "email" | "sms";
  message: string;
};

const MOCK_ALERTS: Alert[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `${i}`,
  scheduledAt: `2026-01-${(i % 28) + 1} 10:00 AM`,
  channel: i % 2 === 0 ? "email" : "sms",
  message: "Follow up with recruiter"
}));

export function Alerts() {
  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Add Alert
          </button>
        </div>

        {/* v1 Notice */}
        <div className="rounded border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Alerts are configuration records only in v1. They do not send emails or SMS.
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-auto rounded border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">
                  Scheduled
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Channel
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Message
                </th>
              </tr>
            </thead>

            <tbody>
              {MOCK_ALERTS.map((alert) => (
                <tr
                  key={alert.id}
                  className="cursor-pointer border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    {alert.scheduledAt}
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={alert.channel} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {alert.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

function ChannelBadge({ channel }: { channel: "email" | "sms" }) {
  const styles =
    channel === "email"
      ? "bg-blue-100 text-blue-800"
      : "bg-purple-100 text-purple-800";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${styles}`}
    >
      {channel.toUpperCase()}
    </span>
  );
}
