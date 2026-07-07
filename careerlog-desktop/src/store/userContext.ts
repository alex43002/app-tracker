import { createContext, useContext } from "react";
import type { User } from "../types/user";

/**
 * Shared current-user store (BUG-14). Previously every authenticated page
 * fetched `/api/users/me` on its own and mounted its own `UserMenu`, so a
 * profile-picture upload only updated that one local copy and never propagated.
 * A single provider gives every surface one source of truth plus a
 * `refreshUser()` to re-pull after a mutation.
 *
 * The context + hook live here (no JSX) and the provider component lives in
 * `UserProvider.tsx`, so each file stays fast-refresh friendly.
 */
export interface UserContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextValue | undefined>(
  undefined,
);

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within a UserProvider");
  }
  return ctx;
}
