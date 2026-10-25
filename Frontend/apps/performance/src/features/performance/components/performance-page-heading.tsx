"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { cn } from "@repo/ds/lib/utils";

/**
 * The dominant page title for a Performance route — the answer to "what page am I on"
 * that sits below the quiet Cycle context. One title per surface, one job each: an
 * optional back affordance for nested/focused states (the approved Core pattern),
 * an optional eyebrow, the title, an optional supporting line, and right-aligned
 * actions. Nested surfaces pass `back` instead of repeating the Cycle name.
 */
export function PerformancePageHeading({
  title,
  description,
  actions,
  eyebrow,
  back,
  leading,
  status,
  className,
  size = "default",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  back?: { href: string; label: string };
  /** What the page is about, set before the title (a record's people). */
  leading?: ReactNode;
  /** A state badge beside the title, outside the heading so it keeps its own type and the title its accessible name. */
  status?: ReactNode;
  className?: string;
  size?: "default" | "display";
}) {
  return (
    <div className={cn("mb-4", className)}>
      {back ? (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-detail"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0">
            {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
            {status ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className={cn(size === "display" ? "type-display" : "type-page-title", "text-foreground")}>{title}</h1>
                {status}
              </div>
            ) : (
              <h1 className={cn(size === "display" ? "type-display" : "type-page-title", "text-foreground")}>{title}</h1>
            )}
            {description ? (
              typeof description === "string" ? (
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  {description}
                </p>
              ) : (
                <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  {description}
                </div>
              )
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
