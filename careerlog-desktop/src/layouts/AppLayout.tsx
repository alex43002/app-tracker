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

    console.log(user)
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r bg-gray-50">
        <div className="px-4 py-5 border-b">
          <h2 className="text-lg font-semibold">CareerLog</h2>
          <p className="text-xs text-gray-500">
            Job application tracker
          </p>
        </div>

        <nav className="p-3 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm ${
                isActive
                  ? "bg-gray-200 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/jobs"
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm ${
                isActive
                  ? "bg-gray-200 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            Jobs
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm ${
                isActive
                  ? "bg-gray-200 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            Alerts
          </NavLink>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (future global actions) */}
        <header className="h-14 border-b bg-white flex items-center justify-between px-6">
            <div className="text-sm text-gray-500">
                {/* Reserved for page title later */}
            </div>

            {user && (
                <UserMenu {...user} />
            )}
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
