"use client";

import { useFusionNotifications } from "@repo/api/query";
import { resolveFusionAttentionModules, useAuth } from "@repo/auth";
import { NotificationBell } from "@repo/ds/shell";

/**
 * The Fusion bell on the home. Every notification path belongs to a module app, so opening one
 * marks it read, waits for that to land, then fully navigates.
 */
export function ShellNotificationBell() {
  const { user } = useAuth();
  const notifications = useFusionNotifications(resolveFusionAttentionModules(user), { enabled: Boolean(user?.tenantId) });
  if (!user?.tenantId) return null;

  return (
    <NotificationBell
      items={notifications.items}
      unreadCount={notifications.unreadCount}
      modules={notifications.modules}
      onMarkAllRead={() => void notifications.markAllRead()}
      onOpenItem={(item) => {
        const notification = notifications.items.find((candidate) => candidate.id === item.id && candidate.module === item.module);
        if (!notification) return;
        void notifications.markRead(notification).finally(() => window.location.assign(notification.href));
      }}
    />
  );
}
