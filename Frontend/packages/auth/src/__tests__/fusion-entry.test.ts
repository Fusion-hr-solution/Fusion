import { describe, expect, it } from "vitest";
import type { EffectivePermissionGrantDto } from "@repo/api";
import {
  canEnterCoreHr,
  canEnterPerformance,
  resolveFusionAttentionModules,
} from "../customer-workspace-access";
import { makeAuthUser } from "./helpers";

function grant(permissionKey: string, scope: EffectivePermissionGrantDto["scope"] = "Self"): EffectivePermissionGrantDto {
  return { permissionKey, scope, label: permissionKey, group: "Performance", helperText: null, allowedScopes: [scope] };
}

const participant = makeAuthUser({
  moduleEntitlements: ["CoreHR", "Performance"],
  effectivePermissions: [grant("performance.objective.self.manage"), grant("core.profile.self.view")],
});

describe("canEnterPerformance", () => {
  it("allows an entitled tenant user holding a Performance entry permission", () => {
    expect(canEnterPerformance(participant)).toBe(true);
    expect(
      canEnterPerformance({ ...participant, effectivePermissions: [grant("performance.cycle.view", "Tenant")] }),
    ).toBe(true);
  });

  it("refuses without the Performance entitlement", () => {
    expect(canEnterPerformance({ ...participant, moduleEntitlements: ["CoreHR"] })).toBe(false);
  });

  it("refuses without a Performance entry permission", () => {
    expect(canEnterPerformance({ ...participant, effectivePermissions: [grant("core.profile.self.view")] })).toBe(false);
  });

  it("refuses a platform administrator and a session without a tenant", () => {
    expect(canEnterPerformance({ ...participant, roles: ["PlatformAdmin"] })).toBe(false);
    expect(canEnterPerformance({ ...participant, tenantId: null })).toBe(false);
    expect(canEnterPerformance(null)).toBe(false);
  });
});

describe("resolveFusionAttentionModules", () => {
  it("lists the modules the user can enter", () => {
    expect(resolveFusionAttentionModules(participant)).toEqual(["core", "performance"]);
  });

  it("leaves out a module the tenant isn't entitled to", () => {
    expect(resolveFusionAttentionModules({ ...participant, moduleEntitlements: ["CoreHR"] })).toEqual(["core"]);
    expect(canEnterCoreHr({ ...participant, moduleEntitlements: ["Performance"] })).toBe(false);
  });

  it("leaves out Core HR when the user can enter none of its workspaces", () => {
    expect(canEnterCoreHr({ ...participant, effectivePermissions: [grant("performance.objective.self.manage")] })).toBe(false);
  });

  it("is empty without a customer tenant", () => {
    expect(resolveFusionAttentionModules({ ...participant, tenantId: null })).toEqual([]);
  });
});
