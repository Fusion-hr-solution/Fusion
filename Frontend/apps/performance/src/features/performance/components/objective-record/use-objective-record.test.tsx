// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useObjectiveRecord } from "./use-objective-record";

const navigation = vi.hoisted(() => ({
  pathname: "/performance/plan",
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => navigation.router,
}));

describe("useObjectiveRecord navigation", () => {
  beforeEach(() => {
    navigation.pathname = "/performance/plan";
    navigation.router.push.mockReset();
    navigation.router.replace.mockReset();
    navigation.router.back.mockReset();
  });

  it("pushes the first objective so closing the drawer returns to the workspace", () => {
    const { result } = renderHook(() => useObjectiveRecord());

    result.current.open({ cycleId: "cycle-1", objectiveId: "objective-1" });

    expect(navigation.router.push).toHaveBeenCalledWith("/cycles/cycle-1/objectives/objective-1", { scroll: false });
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  it("replaces the active drawer when navigating to a related objective", () => {
    navigation.pathname = "/cycles/cycle-1/objectives/objective-1";
    const { result } = renderHook(() => useObjectiveRecord());

    result.current.open({ cycleId: "cycle-1", objectiveId: "objective-2" }, { replace: true });

    expect(navigation.router.replace).toHaveBeenCalledWith("/cycles/cycle-1/objectives/objective-2", { scroll: false });
    expect(navigation.router.push).not.toHaveBeenCalled();
  });

  it("replaces the current objective when switching into progress recording", () => {
    navigation.pathname = "/cycles/cycle-1/objectives/objective-1";
    const { result } = renderHook(() => useObjectiveRecord());

    result.current.open({ cycleId: "cycle-1", objectiveId: "objective-1" }, { mode: "record" });

    expect(navigation.router.replace).toHaveBeenCalledWith("/cycles/cycle-1/objectives/objective-1?mode=record", { scroll: false });
    expect(navigation.router.push).not.toHaveBeenCalled();
  });
});
