import { useState } from "react";
import { Link } from "react-router-dom";
import { confirmEmailVerification, requestEmailVerification } from "../api/auth";
import { ApiError } from "../api/client";

import { AuthLayout, AuthCard, AuthError, AuthNotice } from "../components/auth";

export default function VerifyEmail() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  function describe(err: unknown): string {
    return err instanceof ApiError ? err.displayMessage : "Something went wrong";
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await confirmEmailVerification(token);
      setVerified(true);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestEmailVerification(email);
      // Enumeration-safe: same neutral message whether or not the email exists.
      setNotice(
        `If an account exists for ${email} that still needs verifying, ` +
          "we've sent a new code.",
      );
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <h1 className="text-2xl font-semibold mb-1">Verify your email</h1>

        {verified ? (
          <>
            <AuthNotice message="Your email is verified. Thanks!" />
            <Link
              to="/"
              className="mt-6 block w-full text-center text-sm text-gray-600 underline"
            >
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Enter the code from your verification email.
            </p>

            {notice && <AuthNotice message={notice} />}
            {error && <AuthError message={error} />}

            <form onSubmit={handleConfirm} className="space-y-4 mt-4">
              <input
                type="text"
                placeholder="Verification code"
                className="auth-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-black py-2 text-white disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify email"}
              </button>
            </form>

            <div className="mt-8 border-t pt-6">
              <p className="text-sm text-gray-600 mb-3">Didn't get a code?</p>
              <form onSubmit={handleResend} className="space-y-3">
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
                  className="w-full rounded-md border border-gray-300 py-2 text-sm disabled:opacity-50"
                >
                  Resend verification code
                </button>
              </form>
            </div>

            <Link
              to="/"
              className="mt-6 block w-full text-center text-sm text-gray-600 underline"
            >
              Back to dashboard
            </Link>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
