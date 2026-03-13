import { createApiClient } from "./client";
import type { ApiClient, ApiError } from "./types";

declare const process: { env?: Record<string, string | undefined> } | undefined;

/**
 * Returns true when running in a browser context.
 *
 * Used internally to guard browser-only APIs (localStorage, window).
 * On the server (Node/Edge) this returns false, keeping every import SSR-safe.
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export interface PlatformApiClientConfig {
  /**
   * Override the base URL.
   *
   * Resolution order:
   *  1. Explicit `baseUrl` arg
   *  2. `NEXT_PUBLIC_API_BASE_URL` env var   (set this for SSR to reach the gateway directly)
   *  3. `"/api"`                             (works client-side via Shell proxy rewrites)
   *
   * **SSR note:** Relative `/api` only works in the browser because the Shell
   * dev-server rewrites it to the gateway. Server-side renders have no such
   * proxy, so set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api` (or your
   * gateway URL) when you need SSR fetches to reach the backend.
   */
  baseUrl?: string;
  /**
   * Token retrieval function.
   *
   * Default: reads `accessToken` from the `ey_hr_auth` localStorage entry
   * persisted by `@repo/auth` (browser-only).
   * On the server the default returns `null` — requests proceed without auth.
   *
   * If you need authenticated SSR in the future (e.g. cookie-based auth),
   * provide a custom `getToken` that reads from the request context.
   */
  getToken?: () => string | null;
  /**
   * Called once when the server responds with 401 Unauthorized.
   *
   * Fires at most once per client instance to prevent redirect loops.
   * The `ApiError` is still thrown after this callback runs — callers
   * can catch and handle it normally.
   */
  onAuthError?: (error: ApiError) => void;
}

/**
 * Create a pre-configured API client for the EY HR Platform.
 *
 * **Browser:** uses Shell proxy (`/api`) + localStorage token.
 * **Server:**  uses `NEXT_PUBLIC_API_BASE_URL` (must be absolute) + no auth.
 *
 * SSR-safe: never touches `window` or `localStorage` on the server.
 */
export function createPlatformApiClient(
  config: PlatformApiClientConfig = {}
): ApiClient {
  const baseUrl =
    config.baseUrl ??
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL
      ? process.env.NEXT_PUBLIC_API_BASE_URL
      : "/api");

  const getToken =
    config.getToken ??
    (() => {
      if (isBrowser()) {
        try {
          const raw = localStorage.getItem("ey_hr_auth");
          if (raw) {
            const parsed = JSON.parse(raw) as { accessToken?: string };
            return parsed.accessToken ?? null;
          }
        } catch {
          // Corrupted storage — treat as unauthenticated
        }
        return null;
      }
      // Server-side: no token available — request proceeds without auth.
      return null;
    });

  return createApiClient({
    baseUrl,
    getToken,
    onAuthError: config.onAuthError,
  });
}
