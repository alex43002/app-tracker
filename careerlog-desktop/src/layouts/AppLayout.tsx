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
          className="fixed inset-0 z-30 bg-gray-900/20 lg:hidden transition-colors duration-200 ease-out"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ============================================================
         Sidebar
      ============================================================ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56
          transform bg-gray-50 border-r border-gray-200
          transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Branding */}
        <div className="border-b border-gray-200 px-4 py-5">
          <h2 className="text-base font-semibold text-gray-900">
            CareerLog
          </h2>
          <p className="text-xs text-gray-500">
            Job application tracker
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {[
            { to: "/", label: "Dashboard", end: true },
            { to: "/jobs", label: "Jobs" },
            { to: "/alerts", label: "Alerts" },
          ].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `
                  block rounded-lg px-3 py-2 text-sm
                  transition-colors duration-200 ease-out
                  focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-gray-300
                  focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50
                  ${
                    isActive
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-700 hover:bg-gray-100"
                  }
                `
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ============================================================
         Main Content Area
      ============================================================ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="
                rounded-md p-2 text-gray-600
                hover:bg-gray-100
                active:bg-gray-200
                transition-colors duration-200 ease-out
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-gray-300
                focus-visible:ring-offset-2 focus-visible:ring-offset-white
                lg:hidden
              "
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
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
              {/* Dynamic page title placeholder */}
            </span>
          </div>

          {/* Right */}
          {user && <UserMenu {...user} />}
        </header>

        {/* Scroll Container */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
