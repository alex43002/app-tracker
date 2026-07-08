import { setAuthToken } from "../api/client";
import { clearOfflineCache } from "../api/offlineCache";

const TOKEN_KEY = "careerlog_token";
const EXPIRY_KEY = "careerlog_token_expiry";
const REFRESH_KEY = "careerlog_refresh_token";
const REFRESH_EXPIRY_KEY = "careerlog_refresh_expiry";

/** Token bundle returned by login/register/refresh. */
interface SessionTokens {
  jwt: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

let authReady = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeAuthReady(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isAuthReady() {
  return authReady;
}

export function loadAuthToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);

  if (!token || !expiry) {
    authReady = true;
    notify();
    return null;
  }

  const expiresAt = Number(expiry);
  if (Date.now() >= expiresAt) {
    clearAuthToken();
    authReady = true;
    notify();
    return null;
  }
  setAuthToken(token);
  authReady = true;
  notify();
  return token;
}

export function saveAuthToken(token: string, expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime();
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(expiresAtMs));
  setAuthToken(token);
}

/** Persist a full session (access + refresh tokens) after login/refresh. */
export function saveSession(session: SessionTokens) {
  saveAuthToken(session.jwt, session.expiresAt);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(
    REFRESH_EXPIRY_KEY,
    String(new Date(session.refreshExpiresAt).getTime()),
  );
}

/** Returns the stored refresh token if present and not expired, else null. */
export function getRefreshToken(): string | null {
  const token = localStorage.getItem(REFRESH_KEY);
  const expiry = localStorage.getItem(REFRESH_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() >= Number(expiry)) return null;
  return token;
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REFRESH_EXPIRY_KEY);
  // Drop any cached offline data so it can't leak across accounts (FEAT-9).
  clearOfflineCache();
  setAuthToken(null);
}
