import { describe, expect, it } from "vitest";
import type { RecoveryAction } from "../api";
import { rankActions } from "./recovery-actions";

const PENDING: RecoveryAction[] = ["resend", "revoke", "replace"];
const LAPSED: RecoveryAction[] = ["reissue", "replace"];

describe("rankActions", () => {
  it("keeps a delivered pending invitation calm", () => {
    const { primary, secondary, overflow } = rankActions("pending-sent", PENDING);

    // The recipient acts next, so nothing here should look urgent.
    expect(primary).toBeNull();
    expect(secondary).toEqual(["resend"]);
    expect(overflow).toEqual(["replace", "revoke"]);
  });

  it("leads with resending when the message did not arrive", () => {
    const { primary, secondary, overflow } = rankActions(
      "pending-delivery-failed",
      PENDING
    );

    expect(primary).toBe("resend");
    expect(secondary).toEqual(["replace"]);
    expect(overflow).toEqual(["revoke"]);
  });

  it("leads with reissuing when no usable invitation remains", () => {
    const { primary, secondary } = rankActions("blocked", LAPSED);

    expect(primary).toBe("reissue");
    // Reissuing invites the same address again; when that address is the
    // reason the invitation lapsed, replacing it is the recovery that helps.
    expect(secondary).toEqual(["replace"]);
  });

  it("drops replacement from a lapsed state the service has not permitted it in", () => {
    const { primary, secondary } = rankActions("blocked", ["reissue"]);

    expect(primary).toBe("reissue");
    expect(secondary).toEqual([]);
  });

  it("offers nothing once the administrator has activated", () => {
    const { primary, secondary, overflow } = rankActions("active", PENDING);

    expect(primary).toBeNull();
    expect(secondary).toEqual([]);
    expect(overflow).toEqual([]);
  });

  it("never offers an action the service has not permitted", () => {
    const phases = [
      "pending-sent",
      "pending-delivery-failed",
      "blocked",
      "active",
    ] as const;

    for (const phase of phases) {
      for (const allowed of [[], ["resend"], ["reissue"], PENDING, LAPSED] as RecoveryAction[][]) {
        const { primary, secondary, overflow } = rankActions(phase, allowed);
        const offered = [primary, ...secondary, ...overflow].filter(Boolean);

        for (const action of offered) {
          expect(allowed).toContain(action);
        }
      }
    }
  });

  it("never offers the same action twice", () => {
    for (const phase of ["pending-sent", "pending-delivery-failed", "blocked"] as const) {
      const { primary, secondary, overflow } = rankActions(phase, [
        ...PENDING,
        ...LAPSED,
      ]);
      const offered = [primary, ...secondary, ...overflow].filter(Boolean);

      expect(new Set(offered).size).toBe(offered.length);
    }
  });
});
