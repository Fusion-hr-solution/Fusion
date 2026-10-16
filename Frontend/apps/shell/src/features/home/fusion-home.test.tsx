// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type { AuthUser } from "@repo/auth";
import type { FusionWorkItem } from "@repo/api";
import { FusionHome } from "./fusion-home";

type ModuleState = { key: string; label: string; status: "loading" | "ready" | "error" };

const mocks = vi.hoisted(() => ({
  user: null as AuthUser | null,
  work: { items: [] as FusionWorkItem[], modules: [] as ModuleState[] },
  requested: [] as string[],
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@repo/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({ user: mocks.user, isLoading: false, logout: vi.fn() }),
}));

vi.mock("@repo/api/query", () => ({
  useFusionWork: (modules: string[]) => {
    mocks.requested = modules;
    return {
      ...mocks.work,
      isLoading: false,
      failedModules: mocks.work.modules.filter((module) => module.status === "error"),
      refetch: vi.fn(),
    };
  },
  useFusionNotifications: () => ({
    items: [],
    unreadCount: 0,
    modules: [{ key: "performance", label: "Performance", status: "ready" }],
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));

function grant(permissionKey: string, scope: "Self" | "Tenant" = "Self") {
  return { permissionKey, scope, label: "", group: "", helperText: null, allowedScopes: [scope] };
}

const employee: AuthUser = {
  userId: "u",
  tenantId: "t",
  tenantMembershipId: "m",
  moduleEntitlements: ["CoreHR", "Performance"],
  email: "nour@example.test",
  fullName: "Nour Ben Ali",
  roles: ["Employee"],
  employeeId: "e",
  accessProfiles: [],
  effectivePermissions: [grant("core.profile.self.view"), grant("performance.objective.self.manage")],
};

const ready: ModuleState[] = [
  { key: "core", label: "Core HR", status: "ready" },
  { key: "performance", label: "Performance", status: "ready" },
];

describe("FusionHome", () => {
  beforeEach(() => {
    mocks.user = employee;
  });
  afterEach(() => cleanup());

  it("renders the frame, the greeting and the most important item first for an employee", () => {
    mocks.work = {
      modules: ready,
      items: [
        { id: "a", module: "performance", kind: "self-assessment", title: "Complete your self-assessment", dueOn: "2099-01-02", href: "/performance/reviews/1" },
        { id: "b", module: "performance", kind: "update-request", title: "Update progress on Ship the playbook", href: "/performance/plan" },
      ],
    };
    render(<FusionHome />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/, Nour$/);
    expect(screen.getByText("EY Fusion")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Complete your self-assessment" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Also needs you" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Update progress on Ship the playbook/ }).getAttribute("href")).toBe("/performance/plan");
    expect(mocks.requested).toEqual(["core", "performance"]);
  });

  it("says nothing needs the person when there is no work", () => {
    mocks.work = { modules: ready, items: [] };
    render(<FusionHome />);
    expect(screen.getByText("Nothing needs you right now")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Also needs you" })).toBeNull();
  });

  it("keeps Performance's work when Core HR fails, and says so in one line", () => {
    mocks.work = {
      modules: [{ key: "core", label: "Core HR", status: "error" }, ready[1]!],
      items: [{ id: "a", module: "performance", kind: "plan-write", title: "Write your plan", dueOn: "2099-01-02", href: "/performance/plan" }],
    };
    render(<FusionHome />);
    expect(screen.getByRole("heading", { name: "Write your plan" })).toBeTruthy();
    expect(screen.getByText("Core HR work couldn't be loaded")).toBeTruthy();
  });

  it("offers only the modules the person can enter and reads only their work", () => {
    mocks.user = { ...employee, moduleEntitlements: ["CoreHR"] };
    mocks.work = { modules: [ready[0]!], items: [] };
    render(<FusionHome />);
    expect(screen.queryByRole("link", { name: "Performance" })).toBeNull();
    expect(mocks.requested).toEqual(["core"]);
  });
});
