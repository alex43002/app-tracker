import { useNavigate } from "react-router-dom";
import { clearAuthToken } from "../../store/auth";

interface UserMenuProps {
  fullName: string;
  pfp?: string | null;
}

export function UserMenu({ fullName, pfp }: UserMenuProps) {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthToken();
    navigate("/login", { replace: true });
  }

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      {pfp ? (
        <img
          src={pfp}
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
        {fullName}
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
