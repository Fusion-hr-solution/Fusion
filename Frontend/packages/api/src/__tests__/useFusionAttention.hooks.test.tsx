// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import {
  orderWorkItems,
  useFusionNotifications,
  useFusionUpcoming,
  useFusionWork,
} from "../query/useFusionAttention";
import type {
  FusionAttentionApi,
  FusionNotificationPage,
  FusionUpcoming,
  FusionWorkItem,
} from "../fusion-attention";
import { ApiError } from "../types";

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function work(
  id: string,
  module: "core" | "performance",
  dueOn: string | null = null
): FusionWorkItem {
  return { id, module, kind: "k", title: id, dueOn, href: `/${module}` };
}

function page(
  module: "performance",
  ids: string[],
  unread: string[]
): FusionNotificationPage {
  return {
    items: ids.map((id, index) => ({
      id,
      module,
      kind: "PlanApproved",
      title: id,
      occurredAt: `2026-10-1${index}T10:00:00Z`,
      href: "/performance/plan",
      readAt: unread.includes(id) ? null : "2026-10-14T10:00:00Z",
    })),
    unreadCount: unread.length,
  };
}

function fakeApi(
  overrides: Partial<FusionAttentionApi> = {}
): FusionAttentionApi {
  return {
    getWork: vi.fn(async (key) =>
      key === "core"
        ? [work("c1", "core")]
        : [work("p1", "performance", "2026-10-20")]
    ),
    getNotifications: vi.fn(async () =>
      page("performance", ["n1", "n2"], ["n1", "n2"])
    ),
    markNotificationsRead: vi.fn(async () => ({ unreadCount: 0 })),
    getUpcoming: vi.fn(async () => [] as FusionUpcoming[]),
    ...overrides,
  };
}

describe("useFusionWork", () => {
  it("requests only the modules the viewer may enter", async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useFusionWork(["core"], { api }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getWork).toHaveBeenCalledTimes(1);
    expect(api.getWork).toHaveBeenCalledWith("core", expect.anything());
    expect(result.current.items.map((item) => item.id)).toEqual(["c1"]);
  });

  it("keeps one module's items when another fails", async () => {
    const api = fakeApi({
      getWork: vi.fn(async (key) => {
        if (key === "performance")
          throw new ApiError(503, "Unavailable", ["down"], null);
        return [work("c1", "core")];
      }),
    });
    const { result } = renderHook(
      () => useFusionWork(["core", "performance"], { api }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(["c1"]);
    expect(result.current.failedModules.map((module) => module.key)).toEqual([
      "performance",
    ]);
  });

  it("orders dated work first, earliest due first", () => {
    const ordered = orderWorkItems([
      work("undated", "core"),
      work("late", "performance", "2026-11-01"),
      work("soon", "performance", "2026-10-17"),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["soon", "late", "undated"]);
  });
});

describe("useFusionNotifications", () => {
  it("skips modules that don't serve notifications", async () => {
    const api = fakeApi();
    const { result } = renderHook(
      () => useFusionNotifications(["core"], { api }),
      { wrapper: wrapper() }
    );
    expect(result.current.modules).toEqual([]);
    expect(api.getNotifications).not.toHaveBeenCalled();
    expect(result.current.unreadCount).toBe(0);
  });

  it("merges newest first with the unread count", async () => {
    const api = fakeApi();
    const { result } = renderHook(
      () => useFusionNotifications(["core", "performance"], { api }),
      {
        wrapper: wrapper(),
      }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(["n2", "n1"]);
    expect(result.current.unreadCount).toBe(2);
  });

  it("marks one read optimistically", async () => {
    let resolveMark: (value: { unreadCount: number }) => void = () => {};
    const api = fakeApi({
      markNotificationsRead: vi.fn(
        () =>
          new Promise<{ unreadCount: number }>(
            (resolve) => (resolveMark = resolve)
          )
      ),
    });
    const { result } = renderHook(
      () => useFusionNotifications(["performance"], { api }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.markRead({ id: "n1", module: "performance" });
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(
      result.current.items.find((item) => item.id === "n1")?.readAt
    ).toBeTruthy();
    expect(api.markNotificationsRead).toHaveBeenCalledWith("performance", {
      ids: ["n1"],
    });

    await act(async () => {
      resolveMark({ unreadCount: 1 });
      await pending;
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("marks all read", async () => {
    const api = fakeApi();
    const { result } = renderHook(
      () => useFusionNotifications(["performance"], { api }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.unreadCount).toBe(2));
    await act(async () => {
      await result.current.markAllRead();
    });
    expect(api.markNotificationsRead).toHaveBeenCalledWith("performance", {
      all: true,
    });
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(result.current.items.every((item) => item.readAt)).toBe(true);
  });
});

function moment(
  id: string,
  date: string,
  at: string | null = null
): FusionUpcoming {
  return {
    id,
    module: "performance",
    kind: "one-on-one",
    title: id,
    date,
    at,
    href: "/performance/one-on-ones/s",
  };
}

describe("useFusionUpcoming", () => {
  it("asks only modules that serve moments, for the window, earliest first", async () => {
    const api = fakeApi({
      getUpcoming: vi.fn(async () => [
        moment("plans-due", "2026-10-31"),
        moment("1:1 late", "2026-10-22", "2026-10-22T14:00:00Z"),
        moment("1:1 early", "2026-10-22", "2026-10-22T09:00:00Z"),
      ]),
    });
    const { result } = renderHook(
      () => useFusionUpcoming(["core", "performance"], { api }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getUpcoming).toHaveBeenCalledTimes(1);
    expect(api.getUpcoming).toHaveBeenCalledWith(
      "performance",
      14,
      expect.anything()
    );
    expect(result.current.items.map((item) => item.id)).toEqual([
      "1:1 early",
      "1:1 late",
      "plans-due",
    ]);
  });

  it("asks nothing without an entitled module that serves moments", () => {
    const api = fakeApi();
    renderHook(() => useFusionUpcoming(["core"], { api }), {
      wrapper: wrapper(),
    });
    expect(api.getUpcoming).not.toHaveBeenCalled();
  });

  it("names a failing module and keeps nothing from it", async () => {
    const api = fakeApi({
      getUpcoming: vi.fn(async () =>
        Promise.reject(new ApiError(503, "Unavailable", ["down"], null))
      ),
    });
    const { result } = renderHook(
      () => useFusionUpcoming(["performance"], { api }),
      { wrapper: wrapper() }
    );
    await waitFor(() =>
      expect(result.current.failedModules.map((m) => m.key)).toEqual([
        "performance",
      ])
    );
    expect(result.current.items).toEqual([]);
  });
});

describe("live nudge", () => {
  function stream(events: string[]): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events)
          controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
      },
    });
    return new Response(body, { status: 200 });
  }

  it("opens one stream per module for every bell and refetches when the feed changes", async () => {
    const api = fakeApi();
    const openStream = vi.fn(async (path: string) => {
      expect(path).toBe("/performance/notifications/stream");
      return stream(["ready", "changed"]);
    });
    const Wrapper = wrapper();
    const { result, unmount } = renderHook(
      () => [
        useFusionNotifications(["core", "performance"], { api, openStream }),
        useFusionNotifications(["performance"], { api, openStream }),
      ],
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current[0]!.items).toHaveLength(2));
    await waitFor(() =>
      expect(
        vi.mocked(api.getNotifications).mock.calls.length
      ).toBeGreaterThanOrEqual(2)
    );
    expect(openStream).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("stays off when tests inject an api without a stream", async () => {
    const api = fakeApi();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(
      () => useFusionNotifications(["performance"], { api }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
