"use client";

import { useMemo } from "react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type NotificationFeedDto,
  type PerformanceNotificationDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";

const UNREAD_ONLY = false;
const PAGE = 1;
const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 30_000;

const listParams = { unreadOnly: UNREAD_ONLY, page: PAGE, pageSize: PAGE_SIZE };

/**
 * Activation is the only place a notification is marked read — opening the list never mutates.
 * An unread notification is marked read; a notification with a route deep-links to its workflow.
 */
export function activateNotification(
  notification: PerformanceNotificationDto,
  actions: { markRead: (id: string) => void; navigate: (route: string) => void },
): void {
  if (!notification.isRead) {
    actions.markRead(notification.id);
  }
  if (notification.navigationRoute) {
    actions.navigate(notification.navigationRoute);
  }
}

/**
 * Notification data for the header bell: one polled request per refresh carrying both the list and
 * the unread count, every POLL_INTERVAL_MS (30s) with staleTime 0 so each poll returns fresh state.
 * Polling still pauses while the tab is hidden (refetchIntervalInBackground false), and reading
 * never mutates — nothing is marked read until the user activates a notification.
 *
 * The count used to be a second independent poll, doubling the bell's fixed per-user cost for a
 * number the list response can carry.
 */
export function useNotifications(enabled: boolean) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const feed = useApiQuery<NotificationFeedDto>(
    performanceQueryKeys.notificationList(listParams),
    (signal) =>
      apiClient.get<NotificationFeedDto>(
        `${performancePaths.notifications()}?unreadOnly=${UNREAD_ONLY}&page=${PAGE}&pageSize=${PAGE_SIZE}`,
        { signal },
      ),
    {
      enabled,
      refetchInterval: enabled ? POLL_INTERVAL_MS : false,
      refetchIntervalInBackground: false,
      staleTime: 0,
    },
  );

  const invalidations = [
    { queryKey: performanceQueryKeys.notificationUnreadCount() },
    { queryKey: performanceQueryKeys.notifications() },
  ];

  const markRead = useApiMutation<void, string>(
    (id) => apiClient.post<void>(performancePaths.notificationRead(id)),
    { invalidateQueries: invalidations },
  );

  const markAllRead = useApiMutation<void, void>(
    () => apiClient.post<void>(performancePaths.notificationsReadAll()),
    { invalidateQueries: invalidations },
  );

  return {
    unreadCount: feed.data?.unreadCount ?? 0,
    notifications: feed.data?.notifications.items ?? [],
    isLoading: feed.isLoading,
    error: feed.error,
    markRead,
    markAllRead,
  };
}
