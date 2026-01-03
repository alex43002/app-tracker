import { useNavigate } from "react-router-dom";
import { clearAuthToken } from "../../store/auth";

export default function LogoutButton() {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthToken();
    navigate("/login", { replace: true });
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-red-600 hover:underline"
    >
      Sign out
    </button>
  );
}
