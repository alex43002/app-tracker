/**
 * User domain model returned by the API.
 * All timestamps are ISO-8601 strings.
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  pfp: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
