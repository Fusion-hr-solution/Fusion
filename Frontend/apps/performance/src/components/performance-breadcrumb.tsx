"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  "": "Dashboard",
  cycles: "Cycles",
  objectives: "Objective library",
  notifications: "Notifications",
};

/** Minimal Performance breadcrumb: Performance › <section>. Lives in the left of the top bar. */
export function PerformanceBreadcrumb() {
  const pathname = usePathname();
  const path = pathname.replace(/^\/performance/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  const first = segments[0] ?? "";
  const sectionLabel = SEGMENT_LABELS[first] ?? "Dashboard";
  const isRoot = segments.length === 0;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/"
        className={
          isRoot
            ? "font-medium text-foreground"
            : "text-muted-foreground transition-colors hover:text-foreground"
        }
      >
        Performance
      </Link>
      {!isRoot ? (
        <>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="font-medium text-foreground">{sectionLabel}</span>
        </>
      ) : null}
    </nav>
  );
}
