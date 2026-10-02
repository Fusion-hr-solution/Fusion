import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "@/lib/icons";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";

/**
 * One Overview section: an eyebrow, the one action it leads to, and a short body. Sections are unframed
 * and separated by a hairline, so the page reads as one ranked list of situations rather than a grid of
 * tiles; emphasis is reserved for the section that actually needs the person.
 */
export function OverviewSection({
  label,
  action,
  attention,
  children,
}: {
  label: string;
  action?: ReactNode;
  /** This section needs the person now: its headline carries the accent marker. */
  attention?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      data-attention={attention ? "" : undefined}
      className="group/section border-t border-border/70 pt-6 first:border-t-0 first:pt-0"
    >
      <div className="flex min-h-9 items-center justify-between gap-4">
        <h2 className="type-eyebrow text-muted-foreground">{label}</h2>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** The section's statement — what is true right now — with the accent marker when it needs the person. */
export function Headline({ children, attention, muted }: { children: ReactNode; attention?: boolean; muted?: boolean }) {
  return (
    <p className={cn("type-section-title flex items-center gap-2.5", muted ? "text-muted-foreground" : "text-foreground")}>
      {attention ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
      {children}
    </p>
  );
}

export type Fact = { label: ReactNode; tone?: "default" | "attention" | "critical" };

/** Supporting facts in one quiet line; a fact that needs action carries a dot, never a pill. */
export function Facts({ facts }: { facts: (Fact | null | false)[] }) {
  const shown = facts.filter((fact): fact is Fact => Boolean(fact));
  if (shown.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {shown.map((fact, index) => (
        <li key={index} className="inline-flex items-center gap-1.5">
          {fact.tone === "attention" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
          {fact.tone === "critical" ? <span className="size-1.5 rounded-full bg-destructive" aria-hidden /> : null}
          <span className={cn(fact.tone === "critical" && "text-destructive", fact.tone === "attention" && "text-foreground")}>
            {fact.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Where a section leads. Primary when the section needs the person, a quiet link otherwise. */
export function SectionAction({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Button asChild size="sm" variant={primary ? "default" : "ghost"} className={primary ? undefined : "-mr-2 text-muted-foreground hover:text-foreground"}>
      <Link href={href}>
        {children}
        <ArrowRight className="size-3.5" data-icon="inline-end" aria-hidden />
      </Link>
    </Button>
  );
}

/** A single progress line: track, fill in the objective's tone, and the figure. Missing reads as missing. */
export function ProgressLine({ value, has, fillClass = "bg-primary", className }: { value: number; has: boolean; fillClass?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="relative h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted-foreground/20">
        {has ? <span className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)} style={{ width: `${clamped}%` }} /> : null}
      </span>
      <span className={cn("w-10 shrink-0 text-right text-sm font-medium tabular-nums", has ? "text-foreground" : "text-muted-foreground")}>
        {has ? `${Math.round(value)}%` : "—"}
      </span>
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-5 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}
