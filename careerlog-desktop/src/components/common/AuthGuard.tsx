import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useSyncExternalStore } from "react";
import { subscribeAuthReady, isAuthReady } from "../../store/auth";

interface Props {
  children: JSX.Element;
}

export function AuthGuard({ children }: Props) {
  const ready = useSyncExternalStore(
    subscribeAuthReady,
    isAuthReady,
    () => false
  );

  if (!ready) return null;

  const token = localStorage.getItem("careerlog_token");
  if (!token) return <Navigate to="/login" replace />;

  return children;
}
