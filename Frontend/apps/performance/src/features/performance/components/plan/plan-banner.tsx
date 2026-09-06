"use client";

import type { ReactNode } from "react";
import { cn } from "@repo/ds/lib/utils";

/**
 * A plan-page context banner: a tinted mark, a title, and an optional detail line on the left, with
 * caller-supplied trailing content (facts, scopes, a reviewer, an action) filling the row. The review
 * context bar and the direction bar share this shell so they read as one family — same surface (card,
 * 2xl radius, border), same padding, and therefore the same height for the same number of text lines.
 */
export function PlanBanner({
  mark,
  title,
  detail,
  children,
  className,
}: {
  mark: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-[16rem] flex-[2] items-center gap-3.5">
        {mark}
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight text-foreground">{title}</p>
          {detail ? <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** The banner's leading mark: a fixed 44px tinted square holding an icon or glyph. */
export function PlanBannerMark({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
        className
      )}
    >
      {children}
    </span>
  );
}
