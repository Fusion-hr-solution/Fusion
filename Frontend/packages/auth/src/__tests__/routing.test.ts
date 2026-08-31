import { describe, expect, it } from "vitest";
import type { AuthUser } from "../types";
import {
  resolveDefaultProductDestination,
  resolvePostSignInDestination,
  sanitizeInternalReturnPath,
} from "../routing";

const ORIGIN = "http://localhost:3000";

function grant(permissionKey: string) {
  return {
    permissionKey,
    scope: "Tenant" as const,
    label: permissionKey,
    group: "Test",
    helperText: null,
    allowedScopes: ["Tenant" as const],
  };
}

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    tenantMembershipId: "membership-1",
    moduleEntitlements: ["CoreHR"],
    email: "user@example.com",
    fullName: "Test User",
    roles: ["Employee"],
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
    ...overrides,
  };
}

describe("sanitizeInternalReturnPath", () => {
  it.each([
    ["/core/access", "/core/access"],
    ["/core/employees?tab=active", "/core/employees?tab=active"],
    ["/setup#section", "/setup#section"],
    ["/core/search?q=a%2Fb%20c", "/core/search?q=a%2Fb%20c"],
    [`${ORIGIN}/platform/tenants`, "/platform/tenants"],
  ])("accepts trusted internal destination %s", (candidate, expected) => {
    expect(sanitizeInternalReturnPath(candidate, ORIGIN)).toBe(expected);
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\\\evil.example",
    "/%5cevil.example",
    "/%255cevil.example",
    "https://evil.example",
    "http://evil.example",
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "http://user:pass@localhost:3000/core",
    "/core/\u0000access",
    "http://[invalid",
  ])("rejects unsafe destination %s", (candidate) => {
    expect(sanitizeInternalReturnPath(candidate, ORIGIN)).toBeNull();
  });
});

describe("default product destination", () => {
  const admin = () => user({ effectivePermissions: [grant("access.assignments.view")] });

  it("routes a Platform Administrator to Platform", () => {
    expect(resolveDefaultProductDestination(user({
      tenantId: null,
      tenantMembershipId: null,
      moduleEntitlements: [],
      roles: ["PlatformAdmin"],
    }))).toBe("/platform");
  });

  it("lands a Tenant Administrator on Getting Started while Organization is not Ready", () => {
    expect(resolveDefaultProductDestination(admin())).toBe("/getting-started");
    expect(
      resolveDefaultProductDestination(admin(), { organizationReady: false })
    ).toBe("/getting-started");
  });

  it("lands a Tenant Administrator on Core Home once Organization is Ready", () => {
    expect(
      resolveDefaultProductDestination(admin(), { organizationReady: true })
    ).toBe("/core");
  });

  it("fails closed to Getting Started when readiness is unknown", () => {
    expect(
      resolveDefaultProductDestination(admin(), { organizationReady: null })
    ).toBe("/getting-started");
    expect(
      resolveDefaultProductDestination(admin(), { organizationReady: undefined })
    ).toBe("/getting-started");
  });

  it("resolves the same landing for two administrators of the same tenant", () => {
    const first = admin();
    const second = user({
      userId: "user-2",
      effectivePermissions: [grant("access.assignments.view")],
    });
    expect(
      resolveDefaultProductDestination(first, { organizationReady: true })
    ).toBe(resolveDefaultProductDestination(second, { organizationReady: true }));
    expect(
      resolveDefaultProductDestination(first, { organizationReady: false })
    ).toBe(resolveDefaultProductDestination(second, { organizationReady: false }));
  });

  it("routes another tenant user to a permission-supported destination", () => {
    expect(resolveDefaultProductDestination(user({
      effectivePermissions: [grant("core.employee.view")],
    }))).toBe("/core/employees");
  });

  it("routes an org-chart-only user to the canonical Organization workspace", () => {
    expect(resolveDefaultProductDestination(user({
      effectivePermissions: [grant("core.orgchart.view")],
    }))).toBe("/core/organization");
  });

  it("never blind-defaults a profile-capable manager into the Team workspace", () => {
    // A DirectReports employee-view grant satisfies both own-profile and Team;
    // the safer own-profile landing must win over /core/team.
    expect(resolveDefaultProductDestination(user({
      employeeId: "emp-1",
      roles: ["Manager"],
      effectivePermissions: [
        { ...grant("core.employee.view"), scope: "DirectReports", allowedScopes: ["DirectReports"] },
      ],
    }))).toBe("/core/profile");
  });

  it("lands a genuine team-only user on the Team workspace as a last resort", () => {
    // Only a DirectReports team-view grant (no profile/roster access) still
    // resolves to Team, so real managers keep a meaningful default.
    expect(resolveDefaultProductDestination(user({
      employeeId: "emp-1",
      roles: ["Manager"],
      effectivePermissions: [
        { ...grant("core.team.view"), scope: "DirectReports", allowedScopes: ["DirectReports"] },
      ],
    }))).toBe("/core/team");
  });

  it("returns no destination when the account has no usable context", () => {
    expect(resolveDefaultProductDestination(user({
      tenantId: null,
      tenantMembershipId: null,
      moduleEntitlements: [],
    }))).toBeNull();
  });

  it("lets a safe intended destination override the default", () => {
    expect(resolvePostSignInDestination({
      intendedDestination: "/core/access",
      user: user({ effectivePermissions: [grant("core.employee.view")] }),
      trustedOrigin: ORIGIN,
    })).toBe("/core/access");
  });

  it("lets a safe callback win over readiness-aware admin landing", () => {
    expect(resolvePostSignInDestination({
      intendedDestination: "/core/organization",
      user: admin(),
      trustedOrigin: ORIGIN,
      organizationReady: false,
    })).toBe("/core/organization");
  });

  it("ignores an unsafe callback and uses the readiness-aware admin fallback", () => {
    expect(resolvePostSignInDestination({
      intendedDestination: "/\\evil.example",
      user: admin(),
      trustedOrigin: ORIGIN,
      organizationReady: true,
    })).toBe("/core");
  });

  it("ignores an unsafe intended destination", () => {
    expect(resolvePostSignInDestination({
      intendedDestination: "/\\evil.example",
      user: user({ effectivePermissions: [grant("core.employee.view")] }),
      trustedOrigin: ORIGIN,
    })).toBe("/core/employees");
  });
});
