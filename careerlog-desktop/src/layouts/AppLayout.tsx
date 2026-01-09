import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { UserMenu } from "../components/common/UserMenu";
import type { User } from "../types/user";

export function AppLayout({
  children,
  user,
}: {
  children: ReactNode;
  user?: User;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">
      {/* ============================================================
         Mobile Overlay
      ============================================================ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ============================================================
         Sidebar
      ============================================================ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56
          transform bg-gray-50 border-r
          transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Branding */}
        <div className="border-b px-4 py-5">
          <h2 className="text-lg font-semibold">
            CareerLog
          </h2>
          <p className="text-xs text-gray-500">
            Job application tracker
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          <NavLink
            to="/"
            end
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-gray-200 font-medium text-gray-900"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/jobs"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-gray-200 font-medium text-gray-900"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            Jobs
          </NavLink>

          <NavLink
            to="/alerts"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-gray-200 font-medium text-gray-900"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            Alerts
          </NavLink>
        </nav>
      </aside>

      {/* ============================================================
         Main Content Area
      ============================================================ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="z-10 flex h-14 items-center justify-between border-b bg-white px-4 sm:px-6 shadow-sm">
          {/* Left: Hamburger (mobile) / Page title placeholder */}
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              {/* Hamburger icon */}
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <span className="text-sm font-medium text-gray-700">
              {/* Reserved for dynamic page title */}
            </span>
          </div>

          {/* Right: User menu */}
          {user && <UserMenu {...user} />}
        </header>

        {/* ============================================================
           Scroll Container (single scroll owner)
        ============================================================ */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
