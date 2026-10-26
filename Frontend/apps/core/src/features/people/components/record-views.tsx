"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { createPerformanceApi, createPlatformApiClient, performanceQueryKeys } from "@repo/api";
import { useApiQuery, useReactToPraise } from "@repo/api/query";
import { cn } from "@repo/ds";
import { PersonPerformanceSummary, type PraiseReactionIcons, type RenderSummaryLink } from "@repo/performance-ui";
import { HeartHandshake, Lightbulb, PartyPopper, ThumbsUp } from "lucide-react";

const BASE_PATH = "/core";

/**
 * Profile | Performance: sibling views of one person record, each at its own address. Tabs are links,
 * so each view can be opened, shared and reloaded directly.
 */
export function RecordViewSwitcher({
  profileHref,
  performanceHref,
  current,
}: {
  profileHref: string;
  performanceHref: string;
  current: "profile" | "performance";
}) {
  const t = useTranslations("people.views");
  const views = [
    { key: "profile", label: t("profile"), href: profileHref },
    { key: "performance", label: t("performance"), href: performanceHref },
  ] as const;
  return (
    <nav aria-label={t("label")} className="inline-flex gap-1 rounded-control bg-card p-1">
      {views.map((view) => (
        <Link
          key={view.key}
          href={view.href}
          aria-current={view.key === current ? "page" : undefined}
          className={cn(
            "rounded-nested px-3 py-1.5 type-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view.key === current ? "bg-inlay text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}

/** Core HR paths route inside the app; Performance paths are another app and need a full navigation. */
export const renderCoreLink: RenderSummaryLink = ({ href, className, children }) =>
  href === BASE_PATH || href.startsWith(`${BASE_PATH}/`) ? (
    <Link href={href.slice(BASE_PATH.length) || "/"} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );

/** Core HR's own icon set for praise reactions; the shared parts carry none. */
const REACTION_ICONS: PraiseReactionIcons = {
  Applause: <ThumbsUp />,
  Celebrate: <PartyPopper />,
  Insightful: <Lightbulb />,
  ThankYou: <HeartHandshake />,
};

/**
 * The person's performance on their Core HR record, read from Performance's viewer-shaped summary.
 * It loads on its own, so the Profile view never waits on Performance and a failure stays in place.
 */
export function PerformanceRecordView({ employeeId }: { employeeId: string }) {
  const summary = useApiQuery(performanceQueryKeys.personSummary(employeeId), (signal) =>
    createPerformanceApi(createPlatformApiClient()).getPersonSummary(employeeId, null, signal),
  );
  const react = useReactToPraise();
  return (
    <PersonPerformanceSummary
      renderLink={renderCoreLink}
      reactionIcons={REACTION_ICONS}
      onReact={(praise, kind, add) => react.mutate({ praiseId: praise.id, kind, add })}
      // Praise opens in Performance's drawer; it's another app, so this is a full navigation.
      onOpenPraise={(praise) => window.location.assign(`/performance/feedback?tab=praise&praise=${praise.id}`)}
      state={
        summary.data
          ? { status: "ready", summary: summary.data }
          : summary.error
            ? { status: "error", onRetry: () => void summary.refetch() }
            : { status: "loading" }
      }
    />
  );
}
