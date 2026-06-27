/**
 * Alert domain model. Field names mirror the backend `Alert` schema
 * (`scheduledAlert`, `smsOrEmail`). Timestamps are ISO-8601 strings.
 */
export type Alert = {
  id: string;
  userId?: string;
  scheduledAlert: string;
  smsOrEmail: "email" | "sms";
  message: string;
  lastAlertAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/** Body for POST /api/alerts/. */
export interface CreateAlertPayload {
  scheduledAlert: string;
  smsOrEmail: "email" | "sms";
  message: string;
}

/** Body for PUT /api/alerts/{id} — all fields optional. */
export type UpdateAlertPayload = Partial<CreateAlertPayload>;
