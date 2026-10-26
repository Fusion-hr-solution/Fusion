"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Skeleton } from "../components/ui/skeleton";
import { formatDateParts } from "../lib/dates";

export interface NotificationBellItem {
  id: string;
  module: string;
  title: string;
  context?: string | null;
  actorName?: string | null;
  /** ISO timestamp. */
  occurredAt: string;
  readAt?: string | null;
}

export interface NotificationBellModule {
  key: string;
  label: string;
  status: "loading" | "ready" | "error";
}

export interface NotificationBellProps {
  /** Newest first. */
  items: NotificationBellItem[];
  unreadCount: number;
  /** The modules the bell reads, each with its own load state. */
  modules: NotificationBellModule[];
  onOpenItem: (item: NotificationBellItem) => void;
  onMarkAllRead: () => void;
  /** Reference time for relative stamps; defaults to now. */
  now?: Date;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** The words of a short stamp, in one language. */
export interface StampWords {
  now: string;
  minutes: (count: number) => string;
  hours: (count: number) => string;
  yesterday: string;
}

const ENGLISH_STAMP: StampWords = {
  now: "now",
  minutes: (count) => `${count}m`,
  hours: (count) => `${count}h`,
  yesterday: "Yesterday",
};

/** Short relative stamp: "now", "12m", "3h", "Yesterday", then a date; in another language with its words and locale. */
export function relativeStamp(iso: string, now: Date, words: StampWords = ENGLISH_STAMP, locale?: string): string {
  const at = new Date(iso);
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 1) return words.now;
  if (minutes < 60) return words.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24 && at.getDate() === now.getDate()) return words.hours(hours);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return words.yesterday;
  return formatDateParts(
    at,
    {
      day: "numeric",
      month: "short",
      ...(at.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    },
    "–",
    locale,
  );
}

/**
 * The Fusion notification bell: the unread mark on the trigger and a panel listing what happened,
 * newest first, across the modules the person uses. Presentational; each app connects it to
 * `useFusionNotifications` and decides how an opened entry navigates.
 */
export function NotificationBell({
  items,
  unreadCount,
  modules,
  onOpenItem,
  onMarkAllRead,
  now,
  className,
}: NotificationBellProps) {
  const t = useTranslations("ds.notifications");
  const locale = useLocale();
  const stampWords: StampWords = {
    now: t("stamp.now"),
    minutes: (count) => t("stamp.minutes", { count }),
    hours: (count) => t("stamp.hours", { count }),
    yesterday: t("stamp.yesterday"),
  };
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const reference = now ?? new Date();
  const labels = new Map(modules.map((module) => [module.key, module.label]));
  const visible = filter ? items.filter((item) => item.module === filter) : items;
  const loading = items.length === 0 && modules.some((module) => module.status === "loading");
  const failed = modules.filter((module) => module.status === "error" && (!filter || module.key === filter));
  const label = t("trigger", { count: unreadCount });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} className={cn("relative text-muted-foreground", className)}>
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 ? (
            <span
              data-testid="notification-unread-mark"
              className="absolute top-1 inset-e-1 size-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent lang={locale} align="end" sideOffset={8} className="w-96 max-w-[calc(100vw-2rem)] gap-0 p-0">
        <div className="flex h-12 items-center justify-between gap-3 border-b border-border px-4">
          <h2 className="type-panel-title text-foreground">{t("title")}</h2>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="xs" onClick={onMarkAllRead}>
              {t("markAllRead")}
            </Button>
          ) : null}
        </div>

        {modules.length > 1 ? (
          <div role="group" aria-label={t("filterByModule")} className="flex gap-1 border-b border-border px-3 py-2">
            {[{ key: null, label: t("all") }, ...modules.map((module) => ({ key: module.key as string | null, label: module.label }))].map(
              (option) => (
                <Button
                  key={option.key ?? "all"}
                  variant={filter === option.key ? "secondary" : "ghost"}
                  size="xs"
                  aria-pressed={filter === option.key}
                  onClick={() => setFilter(option.key)}
                >
                  {option.label}
                </Button>
              ),
            )}
          </div>
        ) : null}

        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
          {loading ? (
            <div aria-busy className="space-y-1 p-1">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 px-2 py-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 && failed.length === 0 ? (
            <p className="px-3 py-6 text-center type-body-secondary text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-0.5">
              {visible.map((item) => {
                const unread = !item.readAt;
                return (
                  <li key={`${item.module}:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onOpenItem(item);
                      }}
                      className="flex w-full items-start gap-3 rounded-inset px-2.5 py-2.5 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <Avatar className="mt-0.5 size-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {item.actorName ? initials(item.actorName) : (labels.get(item.module) ?? item.module).slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block type-body", unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {item.title}
                        </span>
                        {item.context ? (
                          <span className="block truncate type-meta text-muted-foreground">{item.context}</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 pt-0.5">
                        <time dateTime={item.occurredAt} className="type-meta text-muted-foreground">
                          {relativeStamp(item.occurredAt, reference, stampWords, locale)}
                        </time>
                        {unread ? <span aria-label={t("unread")} className="size-2 rounded-full bg-primary" /> : <span className="size-2" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {failed.map((module) => (
            <p key={module.key} role="status" className="px-3 py-2 type-meta text-muted-foreground">
              {t("moduleFailed", { module: module.label })}
            </p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
