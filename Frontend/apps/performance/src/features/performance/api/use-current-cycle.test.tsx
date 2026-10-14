// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectedId: null as string | null,
  context: { data: undefined as { selected: { id: string } | null } | undefined, isLoading: false },
  contextEnabled: false,
  queryArgs: undefined as unknown[] | undefined,
  getCycle: vi.fn(async (id: string) => ({ cycle: { id } })),
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({}),
  createPerformanceApi: () => ({ getCycle: state.getCycle }),
  performanceQueryKeys: { cycle: (id: string) => ["performance", "cycle", id] },
}));
vi.mock("@repo/api/query", () => ({
  useApiQuery: (...args: unknown[]) => {
    state.queryArgs = args;
    return { data: undefined, error: null, isLoading: false, isFetching: false, refetch: vi.fn(), invalidate: vi.fn() };
  },
  useApiMutation: vi.fn(),
  useApiQueryClient: vi.fn(),
}));
vi.mock("./use-workspace", () => ({
  useSelectedCycleId: () => state.selectedId,
  useWorkspaceContext: (enabled: boolean) => {
    state.contextEnabled = enabled;
    return state.context;
  },
}));
vi.mock("@repo/auth", () => ({ useAuth: () => ({ user: null, isLoading: false }) }));

import { useCurrentCycle } from "./use-performance";

describe("useCurrentCycle", () => {
  beforeEach(() => {
    state.selectedId = null;
    state.context = { data: { selected: { id: "workspace-cycle" } }, isLoading: false };
    state.contextEnabled = false;
    state.queryArgs = undefined;
    state.getCycle.mockClear();
  });

  it("loads the Cycle selected by workspace context when the route has no Cycle", async () => {
    renderHook(() => useCurrentCycle());

    expect(state.contextEnabled).toBe(true);
    expect(state.queryArgs?.[0]).toEqual(["performance", "cycle", "workspace-cycle"]);
    expect(state.queryArgs?.[2]).toMatchObject({ enabled: true });
    await (state.queryArgs?.[1] as (signal: AbortSignal) => Promise<unknown>)(new AbortController().signal);
    expect(state.getCycle).toHaveBeenCalledWith("workspace-cycle", expect.any(AbortSignal));
  });

  it("keeps the workspace loading state until its selected Cycle is known", () => {
    state.context = { data: undefined, isLoading: true };

    const { result } = renderHook(() => useCurrentCycle());

    expect(result.current.isLoading).toBe(true);
    expect(state.queryArgs?.[2]).toMatchObject({ enabled: false });
  });
});
