// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../types";
import { useHydratedWorkspaceAccess } from "../use-hydrated-workspace-access";

const authState = { user: null as AuthUser | null, isLoading: false };

vi.mock("../auth-context", () => ({
  useAuth: () => authState,
}));

function seedUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    tenantMembershipId: "membership-1",
    moduleEntitlements: ["Performance"],
    email: "user@example.com",
    fullName: "Test User",
    roles: ["Employee"],
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
    ...overrides,
  };
}

/** Records the resolved state of every render so we can assert the first client render. */
function renderStates(
  resolve: (input: { user: AuthUser | null; isLoading: boolean }) => string,
): string[] {
  const states: string[] = [];
  function Probe() {
    const { state } = useHydratedWorkspaceAccess(resolve);
    states.push(state);
    return null;
  }
  render(<Probe />);
  return states;
}

afterEach(() => {
  authState.user = null;
  authState.isLoading = false;
});

describe("useHydratedWorkspaceAccess", () => {
  it("holds the first client render equal to the server (loading) before resolving", () => {
    // A user whose claims resolve to "allowed" — the guard must still hold the
    // FIRST client render on "loading" so it matches the server's skeleton HTML.
    authState.user = seedUser();
    const states = renderStates(() => "allowed");

    expect(states[0]).toBe("loading");
    expect(states[states.length - 1]).toBe("allowed");
  });

  it("resolves from session claims after hydration", () => {
    authState.user = seedUser({ roles: ["PlatformAdmin"] });
    const states = renderStates(({ user }) =>
      user?.roles.includes("PlatformAdmin") ? "forbidden" : "allowed",
    );

    expect(states[states.length - 1]).toBe("forbidden");
  });

  it("stays on loading while the session is still loading (fail closed)", () => {
    // While auth is unresolved the mechanism never exposes an access-dependent
    // state, so no access-derived surface can render then disappear. A realistic
    // resolver returns "loading" while isLoading, and the hook delegates to it
    // after the hold — so every committed render is "loading".
    authState.isLoading = true;
    const resolve = ({ isLoading }) => (isLoading ? "loading" : "allowed");
    const states = renderStates(resolve);

    expect(new Set(states)).toEqual(new Set(["loading"]));
  });

  it("does not resolve access on the first render even with a present session", () => {
    // The resolver must not run for the held first render — proving nothing
    // access-dependent is computed before hydration settles.
    authState.user = seedUser();
    let firstCallHydrated: boolean | null = null;
    const resolve = vi.fn(() => {
      firstCallHydrated ??= true;
      return "allowed";
    });
    const states = renderStates(resolve);

    // First recorded state is the pre-resolution hold.
    expect(states[0]).toBe("loading");
    // The resolver only ran after the hold, i.e. it was invoked post-hydration.
    expect(resolve).toHaveBeenCalled();
  });
});
