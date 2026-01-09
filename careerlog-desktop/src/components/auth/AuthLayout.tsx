import type { ReactNode } from "react";
import { AuthBrandPanel } from "./AuthBrandPanel";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Brand / Value Panel */}
      <AuthBrandPanel />

      {/* Auth Interaction */}
      <div className="flex items-center justify-center bg-gray-50 px-4">
        {children}
      </div>
    </div>
  );
}
