import { describe, expect, it } from "vitest";

import { readPerformanceFailure, requiresReload } from "../performance-failures";
import { ApiError } from "../types";

function problem(
  status: number,
  code: string | null,
  message = "Something happened.",
  details: unknown = null,
): ApiError {
  return new ApiError(status, "", [message], "corr-1", details, code);
}

describe("readPerformanceFailure", () => {
  it("classifies a Core HR outage as retryable and not the caller's fault", () => {
    const failure = readPerformanceFailure(
      problem(503, "Performance.Dependency.CoreWorkforceUnavailable", "Core HR is unavailable."),
    );

    expect(failure.kind).toBe("dependency-unavailable");
    expect(failure.isRetryable).toBe(true);
    expect(failure.fieldErrors).toBeNull();
  });

  it("classifies a closed campaign as blocked rather than as a stale version", () => {
    const failure = readPerformanceFailure(problem(409, "Performance.Campaign.Closed"));

    // Both are 409s, but only one is fixed by reloading — conflating them would tell the user to
    // reload a campaign that will never accept the write.
    expect(failure.kind).toBe("blocked");
    expect(requiresReload(failure)).toBe(false);
  });

  it("classifies a stale version as a conflict that requires a reload", () => {
    const failure = readPerformanceFailure(problem(409, "Performance.VersionConflict"));

    expect(failure.kind).toBe("version-conflict");
    expect(requiresReload(failure)).toBe(true);

    // Never offered as a blind retry: that would overwrite whatever the other person just saved.
    expect(failure.isRetryable).toBe(false);
  });

  it("treats a missing precondition as a conflict needing the current version", () => {
    expect(readPerformanceFailure(problem(428, "Performance.PreconditionRequired")).kind).toBe(
      "version-conflict",
    );
  });

  it("keeps per-field detail on a validation failure", () => {
    const failure = readPerformanceFailure(
      problem(422, "Performance.Validation", "Check the fields.", {
        name: ["Name is required."],
        weight: ["Must total 100%."],
      }),
    );

    expect(failure.kind).toBe("validation");
    expect(failure.fieldErrors).toEqual({
      name: ["Name is required."],
      weight: ["Must total 100%."],
    });
    expect(failure.isRetryable).toBe(false);
  });

  it("classifies a denial without disclosing whether the record exists", () => {
    const failure = readPerformanceFailure(
      problem(403, "Performance.Forbidden", "You do not have access to this."),
    );

    expect(failure.kind).toBe("permission-denied");
    expect(failure.message).not.toMatch(/not found/i);
  });

  it("reads the retry hint from a rate-limited response", () => {
    const failure = readPerformanceFailure(
      problem(429, "Performance.RateLimited", "Too many requests.", { retryAfterSeconds: 45 }),
    );

    expect(failure.kind).toBe("rate-limited");
    expect(failure.retryAfterSeconds).toBe(45);
    expect(failure.isRetryable).toBe(true);
  });

  it("keeps the correlation id so a user's report ties to the server log", () => {
    expect(readPerformanceFailure(problem(500, "Performance.Unexpected")).correlationId).toBe(
      "corr-1",
    );
  });

  // ── Endpoints still on the older envelope carry no code ────────────────────

  it("falls back to status when no code is present", () => {
    expect(readPerformanceFailure(problem(422, null)).kind).toBe("validation");
    expect(readPerformanceFailure(problem(403, null)).kind).toBe("permission-denied");
    expect(readPerformanceFailure(problem(404, null)).kind).toBe("not-found");
    expect(readPerformanceFailure(problem(409, null)).kind).toBe("version-conflict");
    expect(readPerformanceFailure(problem(429, null)).kind).toBe("rate-limited");
    expect(readPerformanceFailure(problem(503, null)).kind).toBe("dependency-unavailable");
    expect(readPerformanceFailure(problem(500, null)).kind).toBe("unexpected");
  });

  it("classifies an unrecognised code by its status rather than guessing from text", () => {
    const failure = readPerformanceFailure(
      problem(422, "Performance.Skills.SomethingNewEntirely", "Fix the scale."),
    );

    expect(failure.kind).toBe("validation");
    expect(failure.code).toBe("Performance.Skills.SomethingNewEntirely");
  });

  it("never matches on message text", () => {
    // A message that mentions "not found" on a 422 must still classify as validation.
    const failure = readPerformanceFailure(
      problem(422, null, "The referenced objective was not found in the plan."),
    );

    expect(failure.kind).toBe("validation");
  });

  // ── Non-ApiError throws ────────────────────────────────────────────────────

  it("reports a network drop as retryable rather than as the user's fault", () => {
    const failure = readPerformanceFailure(new TypeError("Failed to fetch"));

    expect(failure.kind).toBe("unexpected");
    expect(failure.isRetryable).toBe(true);
    expect(failure.message).toBe("Failed to fetch");
  });

  it("handles a thrown non-error value", () => {
    const failure = readPerformanceFailure("something odd");

    expect(failure.kind).toBe("unexpected");
    expect(failure.message).toBe("The request could not be completed.");
  });
});
