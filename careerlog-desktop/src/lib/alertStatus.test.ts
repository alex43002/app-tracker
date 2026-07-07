import { describe, expect, it } from "vitest";
import type { Alert } from "../types/alert";
import {
  isAlertSent,
  isAlertScheduledFuture,
  partitionAlerts,
} from "./alertStatus";

function alert(over: Partial<Alert>): Alert {
  return {
    id: Math.random().toString(36).slice(2),
    scheduledAlert: "2026-01-01T00:00:00Z",
    smsOrEmail: "email",
    message: "ping",
    lastAlertAt: null,
    ...over,
  };
}

describe("alert status (FEAT-27)", () => {
  it("treats a never-fired alert as not sent", () => {
    expect(isAlertSent(alert({ lastAlertAt: null }))).toBe(false);
  });

  it("treats an alert fired for its current schedule as sent", () => {
    expect(
      isAlertSent(
        alert({
          scheduledAlert: "2026-01-01T00:00:00Z",
          lastAlertAt: "2026-01-01T00:05:00Z",
        }),
      ),
    ).toBe(true);
  });

  it("treats a re-scheduled (future) fired alert as pending again", () => {
    expect(
      isAlertSent(
        alert({
          scheduledAlert: "2026-12-01T00:00:00Z",
          lastAlertAt: "2026-01-01T00:00:00Z", // fired the old schedule only
        }),
      ),
    ).toBe(false);
  });

  it("detects future-scheduled pending alerts", () => {
    const future = alert({ scheduledAlert: "2999-01-01T00:00:00Z" });
    const past = alert({ scheduledAlert: "2000-01-01T00:00:00Z" });
    expect(isAlertScheduledFuture(future)).toBe(true);
    expect(isAlertScheduledFuture(past)).toBe(false);
  });

  it("partitions and orders pending vs sent", () => {
    const a = alert({ id: "a", scheduledAlert: "2999-03-01T00:00:00Z" }); // pending
    const b = alert({ id: "b", scheduledAlert: "2999-01-01T00:00:00Z" }); // pending, sooner
    const c = alert({
      id: "c",
      scheduledAlert: "2026-01-01T00:00:00Z",
      lastAlertAt: "2026-01-01T01:00:00Z",
    }); // sent

    const { pending, sent } = partitionAlerts([a, b, c]);
    expect(pending.map((x) => x.id)).toEqual(["b", "a"]); // soonest first
    expect(sent.map((x) => x.id)).toEqual(["c"]);
  });
});
