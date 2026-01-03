import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "../api/auth";
import { saveAuthToken } from "../store/auth";
import { ApiError } from "../api/client";

export default function Login() {
  const navigate = useNavigate();

  // Mode toggle
  const [isSignup, setIsSignup] = useState(false);

  // Signup-only fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Shared auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Signup first if in signup mode
      if (isSignup) {
        await signup({
          email,
          password,
          firstName,
          lastName,
          phoneNumber,
          pfp: "", // placeholder base64 string for v1 testing
        });
      }

      // Login (always)
      const res = await login({ email, password });
      saveAuthToken(res.accessToken, res.expiresIn);
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
    <div className="h-full flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-semibold">
          {isSignup ? "Create account" : "Sign in"}
        </h1>

        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        {/* Signup-only fields */}
        {isSignup && (
          <>
            <input
              type="text"
              placeholder="First name"
              className="w-full border px-3 py-2 rounded"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Last name"
              className="w-full border px-3 py-2 rounded"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />

            <input
              type="tel"
              placeholder="Phone number"
              className="w-full border px-3 py-2 rounded"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </>
        )}

        {/* Email */}
        <input
          type="email"
          placeholder="Email"
          className="w-full border px-3 py-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Password"
          className="w-full border px-3 py-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
        >
          {loading
            ? isSignup
              ? "Creating account…"
              : "Signing in…"
            : isSignup
              ? "Sign up"
              : "Sign in"}
        </button>

        {/* Mode toggle */}
        <button
          type="button"
          onClick={() => setIsSignup(!isSignup)}
          className="w-full text-sm text-gray-600 underline text-center"
        >
          {isSignup
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
