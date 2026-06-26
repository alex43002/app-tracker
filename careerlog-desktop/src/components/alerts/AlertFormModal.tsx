import { useEffect, useState } from "react";
import type { Alert, CreateAlertPayload } from "../../types/alert";

interface AlertFormModalProps {
  open: boolean;
  alert: Alert | null;
  onClose: () => void;
  onSave: (payload: CreateAlertPayload) => void | Promise<void>;
}

/** ISO-8601 → value for `<input type="datetime-local">` (local time, no tz). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function AlertFormModal({
  open,
  alert,
  onClose,
  onSave,
}: AlertFormModalProps) {
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the modal opens (for create or a specific edit).
  useEffect(() => {
    if (!open) return;
    setScheduledLocal(alert ? toLocalInputValue(alert.scheduledAlert) : "");
    setChannel(alert?.smsOrEmail ?? "email");
    setMessage(alert?.message ?? "");
  }, [open, alert]);

  if (!open) return null;

  const canSave = scheduledLocal !== "" && message.trim() !== "" && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      await onSave({
        scheduledAlert: new Date(scheduledLocal).toISOString(),
        smsOrEmail: channel,
        message: message.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white shadow-lg"
      >
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {alert ? "Edit Alert" : "Add Alert"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Schedule a reminder to follow up.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Scheduled time
            </label>
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "email" | "sms")}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Message
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Follow up with recruiter"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : alert ? "Save Alert" : "Add Alert"}
          </button>
        </div>
      </form>
    </div>
  );
}
