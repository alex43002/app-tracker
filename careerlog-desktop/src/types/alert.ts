export type Alert = {
  id: string;
  scheduledAlert: string;
  smsOrEmail: "email" | "sms";
  message: string;
};
