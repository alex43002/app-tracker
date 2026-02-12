import type { User } from "../../types/user";
import LogoutButton from "./LogoutButton";

export function UserMenu(user: User) {
  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4">
      {/* Identity Block */}
      <div className="flex items-center gap-3">
        {user.pfp ? (
          <img
            src={user.pfp}
            alt={fullName}
            className="
              h-9 w-9
              rounded-full
              object-cover
              bg-gray-100
            "
          />
        ) : (
          <div
            className="
              h-9 w-9
              rounded-full
              bg-gray-100
              flex items-center justify-center
              text-xs font-medium text-gray-600
            "
          >
            {initials}
          </div>
        )}

        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
            {fullName}
          </span>
        </div>
      </div>

      {/* Divider (very subtle separation) */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Logout */}
      <LogoutButton />
    </div>
  );
}
