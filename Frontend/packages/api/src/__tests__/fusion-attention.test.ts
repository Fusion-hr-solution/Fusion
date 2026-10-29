import { describe, expect, it, vi } from "vitest";
import {
  createFusionAttentionApi,
  FUSION_ATTENTION_MODULES,
  fusionAttentionPaths,
  fusionAttentionQueryKeys,
} from "../fusion-attention";
import type { ApiClient } from "../types";

function fakeClient(): ApiClient & { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async () => []),
    post: vi.fn(async () => ({ unreadCount: 0 })),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as never;
}

describe("FUSION_ATTENTION_MODULES", () => {
  it("lists Core HR and Performance for work, notifications and moments", () => {
    expect(FUSION_ATTENTION_MODULES.map((m) => [m.key, m.entitlement, m.serves])).toEqual([
      ["core", "CoreHR", { work: true, notifications: true, upcoming: true }],
      ["performance", "Performance", { work: true, notifications: true, upcoming: true }],
    ]);
  });

  it("builds each module's endpoints under its gateway prefix", () => {
    expect(fusionAttentionPaths.work("core")).toBe("/corehr/work");
    expect(fusionAttentionPaths.upcoming("performance")).toBe("/performance/upcoming");
    expect(fusionAttentionPaths.notifications("performance")).toBe("/performance/notifications");
    expect(fusionAttentionPaths.markRead("performance")).toBe("/performance/notifications/read");
  });

  it("keys queries per module", () => {
    expect(fusionAttentionQueryKeys.work("core")).not.toEqual(fusionAttentionQueryKeys.work("performance"));
    expect(fusionAttentionQueryKeys.notifications("performance")).toEqual([
      "fusion-attention",
      "notifications",
      "performance",
    ]);
  });
});

describe("createFusionAttentionApi", () => {
  it("reads a module's work items", async () => {
    const client = fakeClient();
    const signal = new AbortController().signal;
    await createFusionAttentionApi(client).getWork("performance", signal);
    expect(client.get).toHaveBeenCalledWith("/performance/work", { signal });
  });

  it("pages notifications with a cursor and a limit", async () => {
    const client = fakeClient();
    await createFusionAttentionApi(client).getNotifications("performance", { cursor: "abc", limit: 20 });
    expect(client.get).toHaveBeenCalledWith("/performance/notifications", {
      signal: undefined,
      params: { cursor: "abc", limit: 20 },
    });
  });

  it("marks all notifications read", async () => {
    const client = fakeClient();
    const result = await createFusionAttentionApi(client).markNotificationsRead("performance", { all: true });
    expect(client.post).toHaveBeenCalledWith("/performance/notifications/read", { all: true });
    expect(result).toEqual({ unreadCount: 0 });
  });
});
