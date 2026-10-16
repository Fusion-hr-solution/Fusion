"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  createFusionAttentionApi,
  FUSION_ATTENTION_MODULES,
  fusionAttentionQueryKeys,
  type FusionAttentionApi,
  type FusionAttentionModule,
  type FusionAttentionModuleKey,
  type FusionNotification,
  type FusionNotificationPage,
  type FusionWorkItem,
} from "../fusion-attention";
import { createPlatformApiClient } from "../platform";

export type FusionModuleLoadStatus = "loading" | "ready" | "error";

export interface FusionModuleState {
  key: FusionAttentionModuleKey;
  label: string;
  status: FusionModuleLoadStatus;
}

export interface UseFusionAttentionOptions {
  enabled?: boolean;
  /** Injected for tests; defaults to the platform client through the shell's `/api`. */
  api?: FusionAttentionApi;
}

export const FUSION_NOTIFICATION_POLL_MS = 60_000;
const NOTIFICATION_PAGE_SIZE = 20;

function useAttentionApi(api?: FusionAttentionApi): FusionAttentionApi {
  return useMemo(() => api ?? createFusionAttentionApi(createPlatformApiClient()), [api]);
}

function modulesServing(
  keys: readonly FusionAttentionModuleKey[],
  contract: "work" | "notifications",
): FusionAttentionModule[] {
  return FUSION_ATTENTION_MODULES.filter((module) => keys.includes(module.key) && module.serves[contract]);
}

function statusOf(query: { isPending: boolean; isError: boolean; data: unknown }): FusionModuleLoadStatus {
  if (query.isError && query.data === undefined) return "error";
  if (query.isPending) return "loading";
  return "ready";
}

/** Earliest due first; undated work keeps each module's own order after the dated items. */
export function orderWorkItems(items: readonly FusionWorkItem[]): FusionWorkItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = a.item.dueOn ?? null;
      const right = b.item.dueOn ?? null;
      if (left && right && left !== right) return left < right ? -1 : 1;
      if (left && !right) return -1;
      if (!left && right) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * The signed-in person's work across the given modules, one query per module
 * so a failing module never hides the others. `modules` is what the viewer may
 * enter (see `resolveFusionAttentionModules` in `@repo/auth`); modules that
 * don't serve work are skipped. Fetched on mount and on window focus.
 */
export function useFusionWork(
  modules: readonly FusionAttentionModuleKey[],
  options: UseFusionAttentionOptions = {},
) {
  const api = useAttentionApi(options.api);
  const serving = modulesServing(modules, "work");
  const results = useQueries({
    queries: serving.map((module) => ({
      queryKey: fusionAttentionQueryKeys.work(module.key),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.getWork(module.key, signal),
      enabled: options.enabled ?? true,
      refetchOnWindowFocus: true,
      retry: false,
    })),
  });

  const states: FusionModuleState[] = serving.map((module, index) => ({
    key: module.key,
    label: module.label,
    status: statusOf(results[index]!),
  }));
  const items = orderWorkItems(results.flatMap((result) => result.data ?? []));

  return {
    items,
    modules: states,
    isLoading: states.some((state) => state.status === "loading"),
    failedModules: states.filter((state) => state.status === "error"),
    refetch: async () => {
      await Promise.all(results.map((result) => result.refetch()));
    },
  };
}

function withRead(page: FusionNotificationPage, ids: readonly string[] | "all", readAt: string): FusionNotificationPage {
  let changed = 0;
  const items = page.items.map((item) => {
    if (item.readAt || (ids !== "all" && !ids.includes(item.id))) return item;
    changed += 1;
    return { ...item, readAt };
  });
  return {
    ...page,
    items,
    unreadCount: ids === "all" ? 0 : Math.max(0, page.unreadCount - changed),
  };
}

/**
 * The signed-in person's notifications across the given modules, newest first.
 * Polls every 60 seconds and on window focus; no real-time channel. Marking
 * read is optimistic and reconciled with the server afterwards.
 */
export function useFusionNotifications(
  modules: readonly FusionAttentionModuleKey[],
  options: UseFusionAttentionOptions = {},
) {
  const api = useAttentionApi(options.api);
  const queryClient = useQueryClient();
  const serving = modulesServing(modules, "notifications");
  const results = useQueries({
    queries: serving.map((module) => ({
      queryKey: fusionAttentionQueryKeys.notifications(module.key),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.getNotifications(module.key, { limit: NOTIFICATION_PAGE_SIZE }, signal),
      enabled: options.enabled ?? true,
      refetchInterval: FUSION_NOTIFICATION_POLL_MS,
      refetchOnWindowFocus: true,
      retry: false,
    })),
  });

  const states: FusionModuleState[] = serving.map((module, index) => ({
    key: module.key,
    label: module.label,
    status: statusOf(results[index]!),
  }));
  // At most a page per module, so merging on each render is cheap.
  const pages = results.map((result) => result.data).filter((page): page is FusionNotificationPage => Boolean(page));
  const items = pages
    .flatMap((page) => page.items)
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  const unreadCount = pages.reduce((total, page) => total + page.unreadCount, 0);

  const markRead = useCallback(
    async (target: Pick<FusionNotification, "id" | "module"> | "all") => {
      const readAt = new Date().toISOString();
      const affected = target === "all" ? serving.map((module) => module.key) : [target.module];
      for (const key of affected) {
        await queryClient.cancelQueries({ queryKey: fusionAttentionQueryKeys.notifications(key) });
        queryClient.setQueryData<FusionNotificationPage>(fusionAttentionQueryKeys.notifications(key), (page) =>
          page ? withRead(page, target === "all" ? "all" : [target.id], readAt) : page,
        );
      }
      await Promise.all(
        affected.map(async (key) => {
          try {
            const result = await api.markNotificationsRead(
              key,
              target === "all" ? { all: true } : { ids: [target.id] },
            );
            queryClient.setQueryData<FusionNotificationPage>(fusionAttentionQueryKeys.notifications(key), (page) =>
              page ? { ...page, unreadCount: result.unreadCount } : page,
            );
          } catch {
            await queryClient.invalidateQueries({ queryKey: fusionAttentionQueryKeys.notifications(key) });
          }
        }),
      );
    },
    // serving is derived from `modules`; its keys are the stable dependency.
    [api, queryClient, serving.map((module) => module.key).join(",")],
  );

  return {
    items,
    unreadCount,
    modules: states,
    isLoading: states.some((state) => state.status === "loading"),
    failedModules: states.filter((state) => state.status === "error"),
    markRead: (item: Pick<FusionNotification, "id" | "module">) => markRead(item),
    markAllRead: () => markRead("all"),
  };
}
