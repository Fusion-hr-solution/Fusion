"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal tab strip that advertises its own overflow.
 *
 * The strip hides its scrollbar, so with nine tabs on a narrow viewport the list simply stopped
 * at the edge with nothing on screen saying more existed. Each side that has content scrolled out
 * of view now gets a fade plus a nudge button, and the active tab is always scrolled into view —
 * which matters because the tab is URL-driven, so you can land directly on one that starts
 * off-screen.
 */
export function ScrollableTabs({
  children,
  activeKey,
  className,
}: {
  children: ReactNode;
  /** Re-scrolls the active tab into view whenever this changes. */
  activeKey?: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 1px tolerance: fractional scroll positions otherwise leave an arrow stuck on at the end.
    const maxScroll = el.scrollWidth - el.clientWidth;
    setOverflow({
      left: el.scrollLeft > 1,
      right: el.scrollLeft < maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // Overflow changes with the viewport and with the tabs' own width (labels, badges),
    // so watch the strip and its children rather than just the window.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);

    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const active = scrollerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    // "nearest" on both axes: reveal it horizontally without yanking the page vertically.
    active?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeKey]);

  const nudge = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={cn("flex gap-0.5 overflow-x-auto scrollbar-hide", className)}
      >
        {children}
      </div>

      <ScrollEdge side="left" show={overflow.left} onNudge={() => nudge(-1)} />
      <ScrollEdge side="right" show={overflow.right} onNudge={() => nudge(1)} />
    </div>
  );
}

function ScrollEdge({
  side,
  show,
  onNudge,
}: {
  side: "left" | "right";
  show: boolean;
  onNudge: () => void;
}) {
  const isLeft = side === "left";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 flex w-14 items-center transition-opacity duration-200",
        isLeft
          ? "left-0 justify-start bg-gradient-to-r from-zinc-50 via-zinc-50/85 to-transparent"
          : "right-0 justify-end bg-gradient-to-l from-zinc-50 via-zinc-50/85 to-transparent",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <button
        type="button"
        // Supplementary to real tab focus, which scrolls itself into view — so keep these out
        // of the tab order and off the accessibility tree rather than duplicating navigation.
        tabIndex={-1}
        disabled={!show}
        onClick={onNudge}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors duration-150 hover:text-zinc-800",
          show ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {isLeft ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
