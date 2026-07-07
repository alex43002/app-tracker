/* ============================================================
   Optional offline caching (FEAT-9)

   A tiny read-through cache over localStorage. Successful reads are
   cached; when a later fetch fails (e.g. the backend is unreachable),
   the last-known value is returned instead — flagged as `stale` so the
   UI can show an "offline" indicator.

   Cached payloads can contain user data, so `clearOfflineCache()` is
   called on logout to avoid leaking it across accounts.
============================================================ */

import { ApiError } from "./client";

const PREFIX = "careerlog_cache:";

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or non-serializable value — caching is best-effort.
  }
}

export function clearOfflineCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore — nothing actionable if storage is unavailable.
  }
}

export interface CachedResult<T> {
  data: T;
  /** True when `data` came from the cache because the live fetch failed. */
  stale: boolean;
}

/**
 * Run `fetcher`; on success cache and return fresh data. On failure, fall back
 * to the cached value (marked `stale`) if one exists, otherwise rethrow.
 *
 * The fallback applies only to genuine connectivity failures. An `ApiError`
 * means the backend responded with an error envelope (e.g. a 401 after the
 * session/refresh truly expired, a 404, or a 5xx); serving stale cache there
 * would mask a dead session — showing data while unauthorized — or a real
 * error, so those are rethrown and handled by the client (which clears auth and
 * redirects to login on 401).
 */
export async function withOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<CachedResult<T>> {
  try {
    const data = await fetcher();
    writeCache(key, data);
    return { data, stale: false };
  } catch (err) {
    if (err instanceof ApiError) throw err;

    const cached = readCache<T>(key);
    if (cached !== null) {
      return { data: cached, stale: true };
    }
    throw err;
  }
}
