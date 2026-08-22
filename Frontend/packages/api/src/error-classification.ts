import { ApiError } from "./types";

/**
 * The five error classes a client distinguishes, so an unreachable upstream is
 * never confused with an application crash and the UI state matches the real
 * cause. See `frontend-upstream-failure-handling`.
 */
export type ApiErrorKind =
  | "validation" // application validation/business error (400/409/422/404)
  | "auth" // authentication/authorization error (401/403)
  | "upstream-unavailable" // a backend/Gateway is reachable-but-unavailable (502/503/504)
  | "network" // could not reach the server at all (fetch threw)
  | "unexpected"; // an unexpected application/server error (500 and anything else)

/** Status the shell `/api` proxy uses to attribute an unreachable/unavailable upstream. */
export const UPSTREAM_UNAVAILABLE_STATUS = 503;

/** Machine-readable code the shell proxy sets so the class is unambiguous, not status-guessed. */
export const UPSTREAM_UNAVAILABLE_CODE = "upstream_unavailable";

/**
 * Classifies any thrown request failure into one of the five {@link ApiErrorKind}
 * classes. Network/abort failures propagate as `TypeError`/`DOMException` (they are
 * not `ApiError`), so they are recognized here rather than by status.
 */
export function classifyApiError(error: unknown): ApiErrorKind {
  // A cancelled request is not a failure to surface; callers treat it as network-ish.
  if (error instanceof DOMException && error.name === "AbortError") {
    return "network";
  }

  // fetch() rejects with TypeError when the request never reached a server.
  if (error instanceof TypeError) {
    return "network";
  }

  if (error instanceof ApiError) {
    if (
      error.code === UPSTREAM_UNAVAILABLE_CODE ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    ) {
      return "upstream-unavailable";
    }
    if (error.status === 401 || error.status === 403) {
      return "auth";
    }
    if (
      error.status === 400 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 422
    ) {
      return "validation";
    }
    // 500 and any other status: an unexpected server/application error.
    return "unexpected";
  }

  return "unexpected";
}

/** Whether a failure is a transient class that a bounded retry may help. */
export function isRetriableErrorKind(kind: ApiErrorKind): boolean {
  return kind === "upstream-unavailable" || kind === "network";
}
