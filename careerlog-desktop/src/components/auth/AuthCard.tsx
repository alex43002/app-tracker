import type { ReactNode } from "react";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}
