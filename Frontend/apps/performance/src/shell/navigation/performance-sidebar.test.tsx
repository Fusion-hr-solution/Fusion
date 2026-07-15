// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PerformanceSidebar } from "./performance-sidebar";

type TestUser = {
  fullName: string;
  roles: string[];
  employeeId?: string | null;
  permissions?: Array<{ permissionKey: string; scope: string }>;
};

const authState = vi.hoisted(() => ({
  user: {
    fullName: "Employee",
    roles: ["Employee"],
    permissions: [],
  } as TestUser | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/performance",
}));

vi.mock("@repo/auth", () => ({
  PLATFORM_ADMIN_ROLE: "PlatformAdmin",
  hasAnyRole: (user: TestUser | null, roles: string[]) =>
    roles.some((role) => user?.roles.includes(role)),
  canViewObjectivePlanningConfiguration: (user: TestUser | null) =>
    user?.permissions?.some(
      (grant) =>
        grant.scope === "Tenant" &&
        (grant.permissionKey === "performance.objective.policy.view" ||
          grant.permissionKey === "performance.objective.policy.manage"),
    ) ?? false,
  canViewPerformanceCampaigns: (user: TestUser | null) =>
    user?.permissions?.some(
      (grant) =>
        grant.scope === "Tenant" &&
        (grant.permissionKey === "performance.cycle.view" ||
          grant.permissionKey === "performance.cycle.manage"),
    ) ?? false,
  canAccessMyObjectives: (user: TestUser | null) =>
    !!user?.employeeId &&
    (user?.permissions?.some(
      (grant) =>
        grant.permissionKey === "performance.objective.self.manage" &&
        grant.scope === "Self",
    ) ??
      false),
  canManageTeamObjectives: (user: TestUser | null) =>
    user?.permissions?.some(
      (grant) => grant.permissionKey === "performance.objective.team.manage",
    ) ?? false,
  canAccessTeamObjectives: (user: TestUser | null) =>
    !!user?.employeeId &&
    (user?.permissions?.some(
      (grant) => grant.permissionKey === "performance.objective.team.manage",
    ) ??
      false),
  canAccessPlanApprovals: (user: TestUser | null) =>
    !!user?.employeeId &&
    (user?.permissions?.some(
      (grant) => grant.permissionKey === "performance.objective.team.approve",
    ) ??
      false),
  canViewPerformanceStrategy: (user: TestUser | null) =>
    user?.permissions?.some(
      (grant) =>
        grant.scope === "Tenant" &&
        grant.permissionKey === "performance.strategic.view",
    ) ?? false,
  canSeeOwnCoreProfileNavigation: (user: TestUser | null) =>
    !!user?.employeeId &&
    (user?.permissions?.some(
      (grant) => grant.permissionKey === "core.profile.self.view",
    ) ??
      false),
  useAuth: () => ({
    user: authState.user,
    logout: vi.fn(),
  }),
}));

vi.mock("@repo/ds/shell", () => ({
  FUSION_MODULES: [],
  ModuleSidebar: ({
    sections,
    userPanel,
  }: {
    sections: Array<{ title?: string; items: Array<{ label: string; href: string }> }>;
    userPanel?: (collapsed: boolean) => React.ReactNode;
  }) => (
    <nav aria-label="Performance navigation">
      {sections.map((section, index) => (
        <section key={section.title ?? index}>
          {section.title ? <h2>{section.title}</h2> : null}
          {section.items.map((item) => (
            <a key={item.href} href={`/performance${item.href === "/" ? "" : item.href}`}>
              {item.label}
            </a>
          ))}
        </section>
      ))}
      {userPanel ? userPanel(false) : null}
    </nav>
  ),
  ShellUserPanel: ({
    links,
  }: {
    links: Array<{ label: string; href: string }>;
  }) => (
    <nav aria-label="User panel">
      {links.map((link) => (
        <a key={link.href} href={link.href}>
          {link.label}
        </a>
      ))}
    </nav>
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  container = null;
  authState.user = {
    fullName: "Employee",
    roles: ["Employee"],
    permissions: [],
  };
});

function renderSidebar(user: TestUser | null = authState.user) {
  authState.user = user;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<PerformanceSidebar />));
  return container;
}

describe("PerformanceSidebar", () => {
  it("shows only overview for a basic Performance user", () => {
    const sidebar = renderSidebar();

    expect(sidebar.textContent).toContain("Overview");
    expect(sidebar.textContent).not.toContain("Configuration");
    expect(sidebar.textContent).not.toContain("Platform administration");
    expect(sidebar.textContent).not.toContain("Reviews");
    expect(sidebar.textContent).not.toContain("Campaigns");
    expect(sidebar.textContent).not.toContain("Team objectives");
    expect(sidebar.textContent).not.toContain("Plan approvals");
    expect(sidebar.textContent).not.toContain("My objectives");
    expect(sidebar.textContent).not.toContain("Strategy");
  });

  it("shows the Team objectives door for an employee-linked manager", () => {
    const sidebar = renderSidebar({
      fullName: "Manager",
      roles: ["Manager"],
      employeeId: "emp-1",
      permissions: [
        { permissionKey: "performance.objective.team.manage", scope: "DirectReports" },
      ],
    });

    expect(sidebar.textContent).toContain("Team objectives");
    expect(sidebar.querySelector('a[href="/performance/team-objectives"]')).toBeTruthy();
    expect(sidebar.textContent).not.toContain("Campaigns");
    expect(sidebar.textContent).not.toContain("Strategy");
  });

  it("shows the My objectives door for an employee-linked self-manage user", () => {
    const sidebar = renderSidebar({
      fullName: "Employee",
      roles: ["Employee"],
      employeeId: "emp-1",
      permissions: [
        { permissionKey: "performance.objective.self.manage", scope: "Self" },
      ],
    });

    expect(sidebar.textContent).toContain("My objectives");
    expect(sidebar.querySelector('a[href="/performance/my-objectives"]')).toBeTruthy();
    expect(sidebar.textContent).not.toContain("Team objectives");
  });

  it("keeps My objectives and Team objectives as separate doors", () => {
    const sidebar = renderSidebar({
      fullName: "Manager",
      roles: ["Manager"],
      employeeId: "emp-1",
      permissions: [
        { permissionKey: "performance.objective.self.manage", scope: "Self" },
        { permissionKey: "performance.objective.team.manage", scope: "DirectReports" },
      ],
    });

    expect(sidebar.textContent).toContain("My objectives");
    expect(sidebar.textContent).toContain("Team objectives");
    expect(sidebar.querySelector('a[href="/performance/my-objectives"]')).toBeTruthy();
    expect(sidebar.querySelector('a[href="/performance/team-objectives"]')).toBeTruthy();
  });

  it("keeps My objectives, Team objectives, and Plan approvals as separate doors for a manager-employee", () => {
    const sidebar = renderSidebar({
      fullName: "Manager",
      roles: ["Manager"],
      employeeId: "emp-1",
      permissions: [
        { permissionKey: "performance.objective.self.manage", scope: "Self" },
        { permissionKey: "performance.objective.team.manage", scope: "DirectReports" },
        { permissionKey: "performance.objective.team.approve", scope: "DirectReports" },
      ],
    });

    expect(sidebar.textContent).toContain("My objectives");
    expect(sidebar.textContent).toContain("Team objectives");
    expect(sidebar.textContent).toContain("Plan approvals");
    expect(sidebar.querySelector('a[href="/performance/my-objectives"]')).toBeTruthy();
    expect(sidebar.querySelector('a[href="/performance/team-objectives"]')).toBeTruthy();
    expect(sidebar.querySelector('a[href="/performance/plan-approvals"]')).toBeTruthy();
  });

  it("hides Plan approvals from an admin with approval permission but no employee link", () => {
    const sidebar = renderSidebar({
      fullName: "HR Admin",
      roles: ["HRAdmin"],
      employeeId: null,
      permissions: [
        { permissionKey: "performance.objective.team.approve", scope: "Tenant" },
      ],
    });

    expect(sidebar.textContent).not.toContain("Plan approvals");
  });

  it("hides the Team objectives door from an admin with the permission but no employee link", () => {
    // HR/Org admins hold performance.objective.team.manage at Tenant scope but are never a
    // frozen approver, so the manager cockpit must stay hidden rather than dead-end them.
    const sidebar = renderSidebar({
      fullName: "HR Admin",
      roles: ["HRAdmin"],
      employeeId: null,
      permissions: [
        { permissionKey: "performance.objective.team.manage", scope: "Tenant" },
      ],
    });

    expect(sidebar.textContent).not.toContain("Team objectives");
  });

  it("shows the Strategy door for tenant-scoped strategic view without HR permissions", () => {
    const sidebar = renderSidebar({
      fullName: "Direction",
      roles: ["Employee"],
      permissions: [
        { permissionKey: "performance.strategic.view", scope: "Tenant" },
      ],
    });

    expect(sidebar.textContent).toContain("Strategy");
    expect(sidebar.querySelector('a[href="/performance/strategy"]')).toBeTruthy();
    expect(sidebar.textContent).not.toContain("Campaigns");
    expect(sidebar.textContent).not.toContain("Team objectives");
  });

  it("shows campaigns for tenant-scoped campaign permission", () => {
    const sidebar = renderSidebar({
      fullName: "HR Admin",
      roles: ["HRAdmin"],
      permissions: [
        { permissionKey: "performance.cycle.view", scope: "Tenant" },
      ],
    });

    expect(sidebar.textContent).toContain("Campaigns");
    expect(sidebar.querySelector('a[href="/performance/campaigns"]')).toBeTruthy();
  });

  it("shows tenant planning rules for tenant-scoped configuration permission", () => {
    const sidebar = renderSidebar({
      fullName: "Tenant Admin",
      roles: ["HRAdmin"],
      permissions: [
        { permissionKey: "performance.objective.policy.manage", scope: "Tenant" },
      ],
    });

    expect(sidebar.textContent).toContain("Configuration");
    expect(sidebar.textContent).toContain("Objective Planning");
    expect(sidebar.querySelector('a[href="/performance/configuration/planning"]')).toBeTruthy();
    expect(sidebar.textContent).not.toContain("Objective planning configuration");
    expect(sidebar.textContent).not.toContain("Performance setup");
  });

  it("keeps Platform Admin navigation separate from tenant configuration", () => {
    const sidebar = renderSidebar({
      fullName: "Platform Admin",
      roles: ["PlatformAdmin"],
      permissions: [],
    });

    expect(sidebar.textContent).toContain("Platform administration");
    expect(sidebar.textContent).toContain("Performance configuration");
    expect(
      sidebar.querySelector('a[href="/performance/platform/configuration/performance"]'),
    ).toBeTruthy();
    expect(sidebar.textContent).not.toContain("Objective Planning");
    expect(sidebar.textContent).not.toContain("Platform setup");
  });

  it("links My profile to the Core-owned profile route for an employee-linked user", () => {
    // Performance owns no profile route — the link must point at Core's, not a
    // /performance/profile dead end.
    const sidebar = renderSidebar({
      fullName: "Employee",
      roles: ["Employee"],
      employeeId: "emp-1",
      permissions: [
        { permissionKey: "core.profile.self.view", scope: "Self" },
      ],
    });

    expect(sidebar.querySelector('a[href="/core/profile"]')).toBeTruthy();
    expect(sidebar.querySelector('a[href="/performance/profile"]')).toBeNull();
  });

  it("hides My profile from a user with no employee link", () => {
    const sidebar = renderSidebar({
      fullName: "Platform Admin",
      roles: ["PlatformAdmin"],
      employeeId: null,
      permissions: [],
    });

    expect(sidebar.textContent).not.toContain("My profile");
    expect(sidebar.querySelector('a[href="/core/profile"]')).toBeNull();
  });

  it("shows both tenant and platform sections only when both authorities exist", () => {
    const sidebar = renderSidebar({
      fullName: "Combined Admin",
      roles: ["PlatformAdmin", "HRAdmin"],
      permissions: [
        { permissionKey: "performance.objective.policy.view", scope: "Tenant" },
      ],
    });

    expect(sidebar.textContent).toContain("Configuration");
    expect(sidebar.textContent).toContain("Objective Planning");
    expect(sidebar.textContent).toContain("Platform administration");
    expect(sidebar.textContent).toContain("Performance configuration");
  });
});
