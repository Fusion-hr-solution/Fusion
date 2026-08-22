import { describe, expect, it } from "vitest";
import { ApiError } from "../types";
import {
  classifyApiError,
  isRetriableErrorKind,
  UPSTREAM_UNAVAILABLE_CODE,
} from "../error-classification";
import {
  createApiQueryDefaultOptions,
  SHARED_QUERY_DEFAULTS,
} from "../query/provider";

function apiError(status: number, code: string | null = null): ApiError {
  return new ApiError(status, "", ["boom"], null, null, code);
}

describe("classifyApiError", () => {
  it("classifies auth failures", () => {
    expect(classifyApiError(apiError(401))).toBe("auth");
    expect(classifyApiError(apiError(403))).toBe("auth");
  });

  it("classifies validation/business failures", () => {
    for (const status of [400, 404, 409, 422]) {
      expect(classifyApiError(apiError(status))).toBe("validation");
    }
  });

  it("classifies upstream-unavailable by status and by code", () => {
    for (const status of [502, 503, 504]) {
      expect(classifyApiError(apiError(status))).toBe("upstream-unavailable");
    }
    // A proxy 503 carrying the machine-readable code is upstream-unavailable.
    expect(classifyApiError(apiError(503, UPSTREAM_UNAVAILABLE_CODE))).toBe(
      "upstream-unavailable",
    );
  });

  it("classifies an unexpected server error", () => {
    expect(classifyApiError(apiError(500))).toBe("unexpected");
  });

  it("classifies network and abort failures", () => {
    expect(classifyApiError(new TypeError("failed to fetch"))).toBe("network");
    expect(
      classifyApiError(new DOMException("aborted", "AbortError")),
    ).toBe("network");
  });

  it("treats an unknown throwable as unexpected", () => {
    expect(classifyApiError({ nope: true })).toBe("unexpected");
  });
});

describe("isRetriableErrorKind", () => {
  it("retries only transient classes", () => {
    expect(isRetriableErrorKind("upstream-unavailable")).toBe(true);
    expect(isRetriableErrorKind("network")).toBe(true);
    expect(isRetriableErrorKind("auth")).toBe(false);
    expect(isRetriableErrorKind("validation")).toBe(false);
    expect(isRetriableErrorKind("unexpected")).toBe(false);
  });
});

describe("query retry policy", () => {
  const retry = createApiQueryDefaultOptions().queries?.retry;

  it("is a bounded, error-class-aware function", () => {
    expect(typeof retry).toBe("function");
    const fn = retry as (count: number, error: unknown) => boolean;

    // Transient: retried once, never twice (no storm).
    expect(fn(0, apiError(503))).toBe(true);
    expect(fn(1, apiError(503))).toBe(false);
    expect(fn(0, new TypeError("x"))).toBe(true);

    // Business and auth: never retried.
    expect(fn(0, apiError(400))).toBe(false);
    expect(fn(0, apiError(401))).toBe(false);
    expect(fn(0, apiError(500))).toBe(false);
  });
});

describe("shared query defaults do not change unrelated consumers", () => {
  it("keeps the raw baseline at staleTime 0 so adopting retry changes no caching", () => {
    // The baseline that every non-opting consumer receives is unchanged.
    expect(createApiQueryDefaultOptions().queries?.staleTime).toBe(0);
  });

  it("exposes the stale-while-revalidate baseline only as an opt-in", () => {
    const queries = SHARED_QUERY_DEFAULTS.defaultOptions?.queries;
    expect(queries?.staleTime).toBe(30_000);
    // Previous data is retained during background revalidation.
    expect(queries?.placeholderData).toBeDefined();
  });
});
