import { useNavigate } from "react-router-dom";
import { clearAuthToken } from "../../store/auth";
import type { User } from "../../types/user";

export function UserMenu(user: User) {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthToken();
    navigate("/login", { replace: true });
  }

  const initials = (user.firstName + " " + user.lastName)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      {user.pfp ? (
        <img
          src={user.pfp}
          alt="Profile"
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-700">
          {initials}
        </div>
      )}

      {/* Name */}
      <span className="text-sm text-gray-700">
        {(user.firstName + " " + user.lastName)}
      </span>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="text-sm text-red-600 hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
