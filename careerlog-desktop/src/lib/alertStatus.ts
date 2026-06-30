import type { Alert } from "../types/alert";

/**
 * Whether a reminder has already been delivered (FEAT-27).
 *
 * Mirrors the backend's firing rule: an alert is "sent" once `lastAlertAt` is
 * set for its current schedule (`lastAlertAt >= scheduledAlert`). Re-scheduling
 * a fired alert to a later time makes it pending again, exactly as the server's
 * `_is_due` treats it.
 */
export function isAlertSent(alert: Alert): boolean {
  if (!alert.lastAlertAt) return false;
  return (
    new Date(alert.lastAlertAt).getTime() >=
    new Date(alert.scheduledAlert).getTime()
  );
}

/** True when a pending alert's scheduled time is still in the future. */
export function isAlertScheduledFuture(alert: Alert, now: Date = new Date()): boolean {
  return new Date(alert.scheduledAlert).getTime() > now.getTime();
}

/**
 * Split alerts into not-yet-sent (pending) and already-delivered (sent).
 * Pending are ordered soonest-first; sent are ordered most-recently-delivered
 * first.
 */
export function partitionAlerts(alerts: Alert[]): {
  pending: Alert[];
  sent: Alert[];
} {
  const pending: Alert[] = [];
  const sent: Alert[] = [];
  for (const alert of alerts) {
    (isAlertSent(alert) ? sent : pending).push(alert);
  }
  pending.sort(
    (a, b) =>
      new Date(a.scheduledAlert).getTime() - new Date(b.scheduledAlert).getTime()
  );
  sent.sort(
    (a, b) =>
      new Date(b.lastAlertAt ?? 0).getTime() -
      new Date(a.lastAlertAt ?? 0).getTime()
  );
  return { pending, sent };
}
