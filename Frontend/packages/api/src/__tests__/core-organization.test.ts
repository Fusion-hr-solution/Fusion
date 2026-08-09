import { describe, expect, it } from "vitest";

import type { OrganizationChangeDto, OrganizationReadinessDto } from "../core-organization";

describe("canonical Organization read contracts", () => {
  it("preserves structured event and before/after fields through JSON serialization", () => {
    const change: OrganizationChangeDto = {
      id: "change-1",
      orgUnitId: "technology",
      unitName: "Technology",
      unitCode: "TECH",
      effectiveDate: "2026-09-01",
      kind: "Move",
      summary: "Unit moved",
      isCancelled: false,
      businessEventKinds: ["Moved"],
      before: {
        name: "Technology",
        type: { id: "team", name: "Team" },
        parent: { id: "consulting", name: "Consulting", code: "CONS" },
        lifecycleState: "Active",
      },
      after: {
        name: "Technology",
        type: { id: "team", name: "Team" },
        parent: { id: "commercial", name: "Commercial", code: "COMM" },
        lifecycleState: "Active",
      },
    };

    const roundTrip = JSON.parse(JSON.stringify(change)) as OrganizationChangeDto;
    expect(roundTrip.unitName).toBe("Technology");
    expect(roundTrip.unitCode).toBe("TECH");
    expect(roundTrip.businessEventKinds).toEqual(["Moved"]);
    expect(roundTrip.before?.parent?.code).toBe("CONS");
    expect(roundTrip.after?.parent?.name).toBe("Commercial");
  });

  it("represents permanent-root initialization directly in readiness", () => {
    const readiness: OrganizationReadinessDto = {
      isReady: false,
      reason: "The permanent root is not yet effective.",
      hasPermanentRoot: true,
      permanentRootId: "root-1",
      permanentRootFirstEffectiveDate: "2026-09-01",
      isPermanentRootEffective: false,
    };

    expect(readiness).toMatchObject({
      hasPermanentRoot: true,
      permanentRootId: "root-1",
      isPermanentRootEffective: false,
    });
  });
});
