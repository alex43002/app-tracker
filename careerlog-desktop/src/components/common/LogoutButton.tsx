import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthToken, getRefreshToken } from "../../store/auth";
import { logout } from "../../api/auth";

export default function LogoutButton() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = useCallback(() => {
    if (isLoading) return;

    setIsLoading(true);

    // Best-effort server-side revocation of the refresh token, then clear
    // local state regardless of the result.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      logout(refreshToken).catch(() => {});
    }
    clearAuthToken();

    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 120);
  }, [navigate, isLoading]);

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      aria-busy={isLoading}
      className="
        inline-flex
        items-center
        justify-center
        rounded-full
        px-4
        py-1.5
        text-sm
        font-medium
        select-none

        text-red-600
        bg-red-50

        transition-colors
        duration-200
        ease-out

        hover:bg-red-100
        hover:text-red-700

        active:bg-red-200

        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-red-400
        focus-visible:ring-offset-2
        focus-visible:ring-offset-gray-100

        disabled:opacity-50
        disabled:cursor-not-allowed
      "
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
