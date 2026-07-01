import { describe, it, expect } from "vitest";
import {
  SESSION_STATUS_CONFIG,
  SESSION_STATUS_OPTIONS,
} from "@/data/session-status-config";
import type { SessionStatus } from "@/types/admin";

describe("session-status-config", () => {
  const expected: SessionStatus[] = [
    "Planned",
    "InProgress",
    "Completed",
    "Cancelled",
  ];

  it("defines an entry for every SessionStatus", () => {
    for (const s of expected) {
      expect(SESSION_STATUS_CONFIG[s]).toBeDefined();
      expect(SESSION_STATUS_CONFIG[s].labelKey).toBe(s);
      expect(SESSION_STATUS_CONFIG[s].icon).toBeDefined();
    }
  });

  it("exposes all statuses in the options list", () => {
    const values = SESSION_STATUS_OPTIONS.map((o) => o.value);
    for (const s of expected) {
      expect(values).toContain(s);
    }
  });

  it("uses destructive variant for Cancelled", () => {
    expect(SESSION_STATUS_CONFIG.Cancelled.variant).toBe("destructive");
  });
});
