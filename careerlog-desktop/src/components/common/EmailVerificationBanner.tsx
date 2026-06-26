import { Link } from "react-router-dom";

/**
 * Dashboard banner prompting the user to verify their email (FEAT-14).
 * Render this only when the current user's `emailVerified` is false.
 */
export function EmailVerificationBanner() {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
    >
      <span>
        Your email isn’t verified yet. Verify it to secure your account.
      </span>
      <Link
        to="/verify-email"
        className="shrink-0 rounded-md border border-yellow-300 bg-white px-3 py-1 font-medium text-yellow-800 hover:bg-yellow-100"
      >
        Verify email
      </Link>
    </div>
  );
}
