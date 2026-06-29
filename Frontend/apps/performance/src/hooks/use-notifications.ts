"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type { PerformanceNotificationDto, PerformancePageDto } from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

export function useMyNotifications(
  params: { unreadOnly: boolean; page: number; pageSize: number },
  enabled = true
): UseApiQueryResult<PerformancePageDto<PerformanceNotificationDto>> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<PerformancePageDto<PerformanceNotificationDto>>(
        performancePaths.notifications(),
        {
          signal,
          params: {
            unreadOnly: params.unreadOnly,
            page: params.page,
            pageSize: params.pageSize,
          },
        }
      ),
    [client, params.unreadOnly, params.page, params.pageSize]
  );

  return useApiQuery(performanceQueryKeys.notificationList(params), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useUnreadNotificationCount(
  enabled = true
): UseApiQueryResult<number> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<number>(performancePaths.notificationsUnreadCount(), { signal }),
    [client]
  );

  return useApiQuery(performanceQueryKeys.notificationUnreadCount(), queryFn, {
    enabled: isAuthenticated && enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<void, { notificationId: string }>(
    ({ notificationId }) =>
      client.post<void>(performancePaths.notificationRead(notificationId)),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.notifications() }] }
  );
}

export function useMarkAllNotificationsRead() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<void, void>(
    () => client.post<void>(performancePaths.notificationsReadAll()),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.notifications() }] }
  );
}
