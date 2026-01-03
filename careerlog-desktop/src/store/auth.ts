import { setAuthToken } from "../api/client";

const TOKEN_KEY = "careerlog_token";
const EXPIRY_KEY = "careerlog_token_expiry";

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
    console.log("Clearing Auth token")
    clearAuthToken();
    authReady = true;
    notify();
    return null;
  }
  console.log("Setting auth token", token)
  setAuthToken(token);
  authReady = true;
  notify();
  return token;
}

export function saveAuthToken(token: string, expiresIn: number) {
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(expiresAt));
  setAuthToken(token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  setAuthToken(null);
}
