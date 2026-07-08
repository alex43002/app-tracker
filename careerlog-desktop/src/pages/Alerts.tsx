import { useMemo, useState } from "react";

import { AppLayout } from "../layouts/AppLayout";
import { confirm } from "../components/common/dialogs/confirmController";
import { AlertFormModal } from "../components/alerts/AlertFormModal";
import {
  fetchAlerts,
  deleteAlert,
  createAlert,
  updateAlert,
} from "../api/alerts";
import { useCrudResource } from "../hooks/useCrudResource";
import { isAlertScheduledFuture, partitionAlerts } from "../lib/alertStatus";
import type { Alert, CreateAlertPayload } from "../types/alert";

export function Alerts() {
  // The alerts list, its create/update/delete, and the "which row is being
  // edited" tracking are the shared CRUD machine (AUD-09). The list endpoint is
  // paginated and the create/update endpoints return only the changed fields,
  // so those are adapted here to yield full rows the hook can splice in.
  const crud = useCrudResource<Alert, CreateAlertPayload>(
    {
      list: () =>
        fetchAlerts(1, 100, "scheduledAlert", "asc").then((res) => res.items),
      create: async (payload) => {
        const { id } = await createAlert(payload);
        return { id, ...payload, lastAlertAt: null };
      },
      update: async (id, payload) => {
        const { updatedAt } = await updateAlert(id, payload);
        return { ...payload, updatedAt };
      },
      remove: deleteAlert,
    },
    {
      loadError: "Failed to load alerts",
      created: "Alert created",
      updated: "Alert updated",
      deleted: "Alert deleted",
      saveError: "Failed to save alert",
      deleteError: "Failed to delete alert",
    },
  );
  const { items: alerts, loading, editingItem: editing } = crud;
  const [modalOpen, setModalOpen] = useState(false);

  async function handleDelete(alert: Alert) {
    const ok = await confirm({
      title: "Delete this alert?",
      description: "This reminder will be permanently removed.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    await crud.remove(alert.id);
  }

  async function handleSave(payload: CreateAlertPayload) {
    if (await crud.save(payload)) setModalOpen(false);
  }

  const { pending, sent } = useMemo(() => partitionAlerts(alerts), [alerts]);

  function openEdit(alert: Alert) {
    crud.beginEdit(alert.id);
    setModalOpen(true);
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <button
            onClick={() => {
              crud.cancelEdit();
              setModalOpen(true);
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Alert
          </button>
        </div>

        <p className="rounded border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          Alerts are reminders the server delivers when they come due. Whether a
          reminder arrives by email or SMS depends on your server's notification
          configuration.
        </p>

        {/* Alerts List, split into not-yet-sent and delivered (FEAT-27) */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="rounded border p-6 text-sm text-gray-500">
              Loading alerts…
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded border p-6 text-sm text-gray-500">
              No alerts yet. Use “Add Alert” to schedule a reminder.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <AlertSection
                title="Pending"
                subtitle="Scheduled reminders that haven't been sent yet."
                alerts={pending}
                mode="pending"
                emptyText="No pending alerts."
                onEdit={openEdit}
                onDelete={handleDelete}
              />
              <AlertSection
                title="Sent Alerts"
                subtitle="Reminders the server has already delivered."
                alerts={sent}
                mode="sent"
                emptyText="Nothing has been sent yet."
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>

        <AlertFormModal
          open={modalOpen}
          alert={editing}
          onClose={() => {
            setModalOpen(false);
            crud.cancelEdit();
          }}
          onSave={handleSave}
        />
      </div>
    </AppLayout>
  );
}

function AlertSection({
  title,
  subtitle,
  alerts,
  mode,
  emptyText,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  alerts: Alert[];
  mode: "pending" | "sent";
  emptyText: string;
  onEdit: (alert: Alert) => void;
  onDelete: (alert: Alert) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {alerts.length}
        </span>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </div>

      <div className="overflow-hidden rounded border">
        {alerts.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">{emptyText}</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">Scheduled</th>
                <th className="px-4 py-2 text-left font-medium">
                  {mode === "sent" ? "Delivered" : "Status"}
                </th>
                <th className="px-4 py-2 text-left font-medium">Channel</th>
                <th className="px-4 py-2 text-left font-medium">Message</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(alert.scheduledAlert).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {mode === "sent" ? (
                      <span className="text-gray-600">
                        {alert.lastAlertAt
                          ? new Date(alert.lastAlertAt).toLocaleString()
                          : "—"}
                      </span>
                    ) : (
                      <StatusBadge alert={alert} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={alert.smsOrEmail} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{alert.message}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEdit(alert)}
                      className="mr-4 text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(alert)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ alert }: { alert: Alert }) {
  // Pending alerts are either still in the future ("Scheduled") or past-due and
  // awaiting the next scheduler pass ("Due").
  const scheduled = isAlertScheduledFuture(alert);
  const styles = scheduled
    ? "bg-amber-100 text-amber-800"
    : "bg-orange-100 text-orange-800";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${styles}`}
    >
      {scheduled ? "Scheduled · not sent" : "Due · not sent"}
    </span>
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
