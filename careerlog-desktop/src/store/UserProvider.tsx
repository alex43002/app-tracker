import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { User } from "../types/user";
import { fetchCurrentUser } from "../api/users";
import { UserContext } from "./userContext";

/** Provides the shared current-user store to the authenticated route tree. */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const u = await fetchCurrentUser();
    setUser(u);
  }, []);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        // AuthGuard already gates these routes; swallow transient failures and
        // leave `user` null so consumers fall back to their loading state.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}
