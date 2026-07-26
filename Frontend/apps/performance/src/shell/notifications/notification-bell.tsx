"use client";

import { useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import type { PerformanceNotificationDto } from "@repo/api";
import { useAuth } from "@repo/auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { activateNotification, useNotifications } from "./use-notifications";

export function NotificationBell() {
  const { user } = useAuth();
  const enabled = Boolean(user?.employeeId);
  const [open, setOpen] = useState(false);
  const { unreadCount, notifications, isLoading, markRead, markAllRead } =
    useNotifications(enabled);

  if (!enabled) {
    return null;
  }

  const hasUnread = unreadCount > 0;

  function onActivate(notification: PerformanceNotificationDto) {
    activateNotification(notification, {
      markRead: (id) => markRead.mutate(id),
      navigate: (route) => {
        setOpen(false);
        const shellRoute = route.startsWith("/performance")
          ? route
          : `/performance${route.startsWith("/") ? route : `/${route}`}`;
        window.location.assign(shellRoute);
      },
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="relative"
        >
          {hasUnread ? (
            <BellRing className="size-5" aria-hidden />
          ) : (
            <Bell className="size-5" aria-hidden />
          )}
          {hasUnread ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {hasUnread ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isLoading}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <NotificationSkeleton />
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="max-h-[24rem]">
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow
                    notification={notification}
                    onActivate={onActivate}
                  />
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({
  notification,
  onActivate,
}: {
  notification: PerformanceNotificationDto;
  onActivate: (notification: PerformanceNotificationDto) => void;
}) {
  const clickable = Boolean(notification.navigationRoute) || !notification.isRead;
  return (
    <button
      type="button"
      onClick={() => onActivate(notification)}
      disabled={!clickable}
      className={cn(
        "flex w-full gap-3 px-4 py-3 text-left transition-colors",
        clickable && "hover:bg-muted/60",
        !notification.isRead && "bg-primary/[0.04]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          notification.isRead ? "bg-transparent" : "bg-primary",
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            notification.isRead ? "font-medium" : "font-semibold",
          )}
        >
          {notification.title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground/80">
          {formatRelative(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Bell className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <span className="text-sm font-medium">You&apos;re all caught up</span>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-2.5 w-full rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
