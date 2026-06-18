"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@repo/ui";
import { useAuth } from "@repo/auth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
} from "@/hooks/use-notifications";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, error } = useMyNotifications(
    { unreadOnly, page: 1, pageSize: 50 },
    isAuthenticated
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.items ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cycle updates and objective-setting deadline reminders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setUnreadOnly((v) => !v)}>
            {unreadOnly ? "Show all" : "Unread only"}
          </Button>
          <Button
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isLoading}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {error ? (
        <EmptyState icon={Bell} title="Could not load notifications" description={error.message} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="No notifications to show."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-70" : undefined}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    {!n.isRead ? <Badge variant="default">New</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {!n.isRead ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markRead.mutate({ notificationId: n.id })}
                  >
                    Mark read
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
