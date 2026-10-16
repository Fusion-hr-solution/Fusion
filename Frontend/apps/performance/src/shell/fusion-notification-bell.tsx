"use client";

import { useRouter } from "next/navigation";
import { useFusionNotifications } from "@repo/api/query";
import { resolveFusionAttentionModules, useAuth } from "@repo/auth";
import { NotificationBell } from "@repo/ds/shell";

const BASE_PATH = "/performance";

/**
 * The Fusion bell in Performance's top bar. Opening an entry marks it read, then navigates: inside
 * Performance with the router, to another app with a full navigation (each app is its own MFE).
 */
export function FusionNotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
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
        const read = notifications.markRead(notification);
        if (notification.href === BASE_PATH || notification.href.startsWith(`${BASE_PATH}/`)) {
          router.push(notification.href.slice(BASE_PATH.length) || "/");
        } else {
          // A full navigation unloads the page, so let the read land first.
          void read.finally(() => window.location.assign(notification.href));
        }
      }}
    />
  );
}
