import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "../api/auth";
import { saveAuthToken } from "../store/auth";
import { ApiError } from "../api/client";

import {
  AuthLayout,
  AuthCard,
  AuthError,
  SignupFields,
} from "../components/auth";

export default function Login() {
  const navigate = useNavigate();

  const [isSignup, setIsSignup] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignup) {
        await signup({
          email,
          password,
          firstName,
          lastName,
          phoneNumber,
          pfp: "",
        });
      }

      const res = await login({ email, password });
      saveAuthToken(res.jwt, res.expiresIn);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <h1 className="text-2xl font-semibold mb-1">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          {isSignup
            ? "Start organizing your job search today."
            : "Sign in to continue tracking your progress."}
        </p>

        {error && <AuthError message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {isSignup && (
            <SignupFields
              firstName={firstName}
              lastName={lastName}
              phoneNumber={phoneNumber}
              setFirstName={setFirstName}
              setLastName={setLastName}
              setPhoneNumber={setPhoneNumber}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black py-2 text-white disabled:opacity-50"
          >
            {loading
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Sign up"
                : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignup(!isSignup)}
          className="mt-6 w-full text-sm text-gray-600 underline"
        >
          {isSignup
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
      </AuthCard>
    </AuthLayout>
  );
}
