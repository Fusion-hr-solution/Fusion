import { describe, expect, it } from "vitest";
import type { OrganizationImportSemanticAssistance } from "@repo/api";
import { describeAssistance } from "./match-assistance";

const assistance = (overrides: Partial<OrganizationImportSemanticAssistance>): OrganizationImportSemanticAssistance => ({
  state: "Succeeded",
  inputFingerprint: "f",
  examinedCount: 5,
  appliedCount: 0,
  abstainedCount: 0,
  remainingCount: 0,
  lastCompletedAt: null,
  canRetry: false,
  retryAfter: null,
  failureCategory: null,
  consentScope: "Tenant",
  ...overrides,
});

describe("describeAssistance", () => {
  it("credits AI when it matched everything", () => {
    expect(describeAssistance(assistance({ appliedCount: 5 }), 0)).toEqual({
      summary: "AI matched 5 items. Everything is ready for review.",
      action: null,
    });
  });

  it("says what AI did and what is left when it matched part", () => {
    expect(describeAssistance(assistance({ appliedCount: 4, abstainedCount: 1 }), 1).summary).toBe(
      "AI matched 4 items. 1 item still needs your review."
    );
  });

  it("is honest when AI answered but matched nothing, without offering a pointless rerun", () => {
    const view = describeAssistance(assistance({ appliedCount: 0, abstainedCount: 3 }), 3);
    expect(view.summary).toBe("AI wasn't confident about any of these. 3 items need your review.");
    expect(view.action).toBeNull();
  });

  it("offers a retry after a transient failure", () => {
    const view = describeAssistance(assistance({ state: "Failed", canRetry: true, failureCategory: "Timeout" }), 2);
    expect(view.summary).toBe("AI matching didn't finish. 2 items need your review.");
    expect(view.action).toEqual({ label: "Retry AI matching", retry: true, grantConsent: false });
  });

  it("offers nothing when AI is unavailable", () => {
    const view = describeAssistance(assistance({ state: "Failed", canRetry: false, failureCategory: "Unauthorized" }), 2);
    expect(view.summary).toBe("AI matching isn't available right now. 2 items need your review.");
    expect(view.action).toBeNull();
  });

  it("offers to match labels that appeared after a run", () => {
    const view = describeAssistance(assistance({ state: "Stale", appliedCount: 2, canRetry: true }), 1);
    expect(view.summary).toBe("AI matched 2 items. 1 item still needs your review.");
    expect(view.action?.label).toBe("Match new labels with AI");
  });

  it("stays quiet about AI when none was involved", () => {
    expect(describeAssistance(assistance({ state: "NotNeeded" }), 0).summary).toBe("Everything is matched.");
    expect(describeAssistance(assistance({ state: "Skipped" }), 2)).toEqual({ summary: "2 items need your review.", action: null });
    expect(describeAssistance(null, 1)).toEqual({ summary: "1 item needs your review.", action: null });
  });
});
