import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { confirmPasswordReset, requestPasswordReset } from "../api/auth";
import { ApiError } from "../api/client";

import {
  AuthLayout,
  AuthCard,
  AuthError,
  AuthNotice,
} from "../components/auth";

type Phase = "request" | "confirm";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function describe(err: unknown): string {
    return err instanceof ApiError
      ? err.displayMessage
      : "Something went wrong";
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      // The API is enumeration-safe, so we always show the same neutral message.
      setNotice(
        `If an account exists for ${email}, we've sent a reset code. ` +
          "Enter it below along with your new password.",
      );
      setPhase("confirm");
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset(token, newPassword);
      navigate("/login", {
        replace: true,
        state: { notice: "Password updated. Please sign in." },
      });
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <h1 className="text-2xl font-semibold mb-1">Reset your password</h1>
        <p className="text-sm text-gray-600 mb-6">
          {phase === "request"
            ? "We'll email you a code to reset your password."
            : "Enter the code from your email and choose a new password."}
        </p>

        {notice && <AuthNotice message={notice} />}
        {error && <AuthError message={error} />}

        {phase === "request" ? (
          <form onSubmit={handleRequest} className="space-y-4 mt-4">
            <input
              type="email"
              placeholder="Email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-black py-2 text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase("confirm");
              }}
              className="w-full text-sm text-gray-600 underline"
            >
              I already have a code
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4 mt-4">
            <input
              type="text"
              placeholder="Reset code"
              className="auth-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              className="auth-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-black py-2 text-white disabled:opacity-50"
            >
              {loading ? "Updating…" : "Set new password"}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 block w-full text-center text-sm text-gray-600 underline"
        >
          Back to sign in
        </Link>
      </AuthCard>
    </AuthLayout>
  );
}
