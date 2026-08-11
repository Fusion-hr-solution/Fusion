import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../types";
import {
  coreOrganizationQueryKeys,
  createCoreOrganizationApi,
  organizationCalendarDate,
  organizationIfMatch,
  translateOrganizationError,
  type OrganizationChangeDto,
  type OrganizationReadinessDto,
} from "../core-organization";
import type { ApiClient } from "../types";

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

  it("keys every temporal query by the exact calendar date", () => {
    expect(coreOrganizationQueryKeys.hierarchy("2026-08-09")).toEqual([
      "coreOrganization",
      "hierarchy",
      "2026-08-09",
    ]);
    expect(coreOrganizationQueryKeys.search("ops", "2026-08-10")).toEqual([
      "coreOrganization",
      "search",
      "2026-08-10",
      "ops",
    ]);
    expect(coreOrganizationQueryKeys.upcomingChange("operation-7").at(-1)).toBe(
      "operation-7"
    );
  });

  it("rejects timestamps and impossible calendar dates", () => {
    expect(organizationCalendarDate("2026-08-09")).toBe("2026-08-09");
    expect(() => organizationCalendarDate("2026-08-09T00:00:00Z")).toThrow(
      "calendar date"
    );
    expect(() => organizationCalendarDate("2026-02-30")).toThrow("Invalid");
  });

  it("sends canonical dates and quoted If-Match versions", async () => {
    const post = vi.fn().mockResolvedValue({ id: "technology" });
    const client = {
      get: vi.fn(),
      post,
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient;
    const api = createCoreOrganizationApi(client);

    await api.moveUnit("technology", 17, {
      targetParentId: "commercial",
      effectiveDate: "2026-09-01",
    });

    expect(post).toHaveBeenCalledWith(
      "/corehr/organization/units/technology/move",
      { targetParentId: "commercial", effectiveDate: "2026-09-01" },
      { headers: { "If-Match": '"17"' } }
    );
    expect(organizationIfMatch(0)).toBe('"0"');
  });

  it("translates validation and concurrency without parsing prose", () => {
    expect(
      translateOrganizationError(
        new ApiError(412, "Precondition Failed", ["The unit changed."], null)
      )
    ).toMatchObject({ kind: "concurrency", message: "The unit changed." });

    expect(
      translateOrganizationError(
        new ApiError(
          400,
          "Bad Request",
          ["Check the fields."],
          "correlation-1",
          { Name: ["Name is required."] }
        )
      )
    ).toEqual({
      kind: "validation",
      message: "Check the fields.",
      fieldErrors: { Name: ["Name is required."] },
      correlationId: "correlation-1",
    });
  });
});
