"use client";

import type { ReactNode } from "react";
import { cn } from "@repo/ds/lib/utils";

/** The banner's leading mark: a fixed 44px tinted square holding an icon or glyph. */
export function PlanBannerMark({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-control ring-1",
        className
      )}
    >
      {children}
    </span>
  );
}
