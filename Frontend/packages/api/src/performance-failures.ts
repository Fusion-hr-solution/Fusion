// ── Performance failure classification ───────────────────────────────────────
// Turns a thrown ApiError into the one thing a surface needs to know: which kind of failure this
// is, so it can show a truthful state instead of a generic "something went wrong".

import { ApiError } from "./types";

/**
 * The failure classes a Performance surface must distinguish. Each one implies a different
 * truthful state and a different next action for the user.
 */
export type PerformanceFailureKind =
  /** The user's input is wrong and they can fix it. Keep their input; highlight the fields. */
  | "validation"
  /** Not the caller's to see or do. Says nothing about whether the record exists. */
  | "permission-denied"
  /** Someone else changed it first. Reload and reapply — never silently retry with a stale version. */
  | "version-conflict"
  /** The record is gone, or was never visible to this caller. */
  | "not-found"
  /** A rule blocks this right now — including a closed campaign's read-only archive. */
  | "blocked"
  /** Core HR is down. The caller did nothing wrong and the same request may succeed later. */
  | "dependency-unavailable"
  /** Too many expensive requests. Nothing was written. */
  | "rate-limited"
  /** Something broke on our side. Nothing the user can act on except retry or report. */
  | "unexpected";

export interface PerformanceFailure {
  kind: PerformanceFailureKind;
  /** Machine-readable code when the endpoint sent one, else null. */
  code: string | null;
  /** Message safe to show the user. */
  message: string;
  /** Per-field messages for a validation failure, keyed by field name. */
  fieldErrors: Record<string, string[]> | null;
  /** Include in a bug report; ties the user's screen to the server's log. */
  correlationId: string | null;
  /** True when retrying the identical request is a sensible thing to offer. */
  isRetryable: boolean;
  /** Seconds to wait before retrying, when the server said. */
  retryAfterSeconds: number | null;
}

/** Codes the module owns, matched exactly rather than by substring. */
const KNOWN_CODES: Record<string, PerformanceFailureKind> = {
  "Performance.Dependency.CoreWorkforceUnavailable": "dependency-unavailable",
  "Performance.Campaign.Closed": "blocked",
  "Performance.Campaign.OutstandingWork": "blocked",
  "Performance.RateLimited": "rate-limited",
  "Performance.VersionConflict": "version-conflict",
  "Performance.Forbidden": "permission-denied",
  "Performance.NotFound": "not-found",
  "Performance.PreconditionRequired": "version-conflict",
  "Performance.Validation": "validation",
  "Performance.Invalid": "validation",
  "Performance.Unexpected": "unexpected",
};

/**
 * Classifies by code when the endpoint sends one, falling back to status otherwise.
 *
 * Both paths are supported deliberately: the problem-details contract landed endpoint by endpoint,
 * so a surface must read either shape without knowing which it is talking to.
 */
function classify(error: ApiError): PerformanceFailureKind {
  if (error.code && KNOWN_CODES[error.code]) {
    return KNOWN_CODES[error.code]!;
  }

  // A code we do not recognise still tells us its shape through the status.
  switch (error.status) {
    case 400:
    case 422:
      return "validation";
    case 401:
    case 403:
      return "permission-denied";
    case 404:
      return "not-found";
    case 409:
      return "version-conflict";
    case 412:
    case 428:
      return "version-conflict";
    case 429:
      return "rate-limited";
    case 503:
    case 504:
      return "dependency-unavailable";
    default:
      return error.status >= 500 ? "unexpected" : "blocked";
  }
}

/**
 * A conflict is a version conflict only when it is about staleness. A rule that blocks the action —
 * a closed campaign, a plan already submitted — is a different state and a different message.
 */
function refineConflict(error: ApiError, kind: PerformanceFailureKind): PerformanceFailureKind {
  if (kind !== "version-conflict" || !error.code) {
    return kind;
  }

  const isStaleness =
    error.code.includes("Concurrency") ||
    error.code.includes("Stale") ||
    error.code.includes("VersionConflict") ||
    error.code.includes("PreconditionRequired");

  return isStaleness ? "version-conflict" : "blocked";
}

const RETRYABLE: ReadonlySet<PerformanceFailureKind> = new Set([
  "dependency-unavailable",
  "rate-limited",
  "unexpected",
]);

function readRetryAfter(details: unknown): number | null {
  if (details !== null && typeof details === "object" && "retryAfterSeconds" in details) {
    const value = (details as { retryAfterSeconds: unknown }).retryAfterSeconds;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return null;
}

function readFieldErrors(details: unknown): Record<string, string[]> | null {
  if (details === null || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const entries = Object.entries(details as Record<string, unknown>).filter(
    ([, value]) =>
      Array.isArray(value) && value.every((item) => typeof item === "string"),
  );

  return entries.length > 0
    ? (Object.fromEntries(entries) as Record<string, string[]>)
    : null;
}

/**
 * Reads any thrown value into a failure a surface can render truthfully.
 *
 * Non-ApiError throws (a network drop, an aborted fetch) are reported as retryable rather than as
 * the user's fault.
 */
export function readPerformanceFailure(error: unknown): PerformanceFailure {
  if (!(error instanceof ApiError)) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "The request could not be completed.";

    return {
      kind: "unexpected",
      code: null,
      message,
      fieldErrors: null,
      correlationId: null,
      isRetryable: true,
      retryAfterSeconds: null,
    };
  }

  const kind = refineConflict(error, classify(error));

  return {
    kind,
    code: error.code,
    message: error.errors[0] ?? error.message,
    fieldErrors: kind === "validation" ? readFieldErrors(error.details) : null,
    correlationId: error.correlationId,
    isRetryable: RETRYABLE.has(kind),
    retryAfterSeconds: readRetryAfter(error.details),
  };
}

/**
 * A version conflict means the caller's copy is stale: they must reload before reapplying, and a
 * silent retry would write over whatever the other person just did.
 */
export function requiresReload(failure: PerformanceFailure): boolean {
  return failure.kind === "version-conflict";
}
