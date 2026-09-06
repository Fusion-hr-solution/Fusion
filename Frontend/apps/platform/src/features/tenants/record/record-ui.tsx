"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ds/lib/utils";

/**
 * The tenant record's visual system.
 *
 * The problem solved here rather than in each destination is hierarchy: a
 * record where every area is an identically weighted white box makes the reader
 * do the ranking the interface should have done. Surfaces
 * therefore come in two weights — a bordered card for what the tenant *is*, and
 * a quieter dashed panel for what it does not yet have.
 *
 * How the record states an absence lives in `../availability`, which the
 * directory shares.
 */

export type SurfaceTone = "neutral" | "attention" | "positive";

const TILE_TONE: Record<SurfaceTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  attention: "bg-destructive/12 text-destructive",
  positive: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
};

/**
 * A small tinted glyph that gives a section a shape before it is read. Always
 * decorative — every state it accompanies is also stated in words.
 */
export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "default",
  className,
}: {
  icon: LucideIcon;
  tone?: SurfaceTone;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        size === "sm" ? "size-7" : "size-9",
        TILE_TONE[tone],
        className
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

/**
 * What the tenant is. A solid card, because its content is real.
 *
 * Two header shapes. Ordinary summaries lead with their title. A surface that
 * carries a *state* passes `headline`, which demotes the title to an eyebrow
 * and gives the state the weight — the eyebrow says which area this is, the
 * headline says what is true of it right now.
 *
 * `emphasis` is reserved for the one area a tenant is actually waiting on, so
 * that weight keeps its meaning: if two things look urgent, neither does.
 */
export function RecordSurface({
  id,
  title,
  headline,
  description,
  icon,
  tone = "neutral",
  emphasis = false,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: {
  id: string;
  title: string;
  /** The current state, when this surface exists to report one. */
  headline?: string;
  description?: string;
  icon?: LucideIcon;
  tone?: SurfaceTone;
  emphasis?: boolean;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const isAttention = tone === "attention";

  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card",
        emphasis
          ? isAttention
            ? "border-destructive/35 shadow-raised"
            : "border-border shadow-raised"
          : "border-border",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4",
          // A wash rather than a filled banner: enough to mark the surface as
          // the page's subject without turning attention into alarm.
          emphasis && isAttention && "bg-destructive/[0.035]"
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <IconTile icon={icon} tone={tone} size={headline ? "default" : "sm"} />
          ) : null}
          <div className="min-w-0">
            <h2
              id={id}
              className={cn(
                headline
                  ? "text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  : "text-sm font-semibold text-foreground"
              )}
            >
              {title}
            </h2>
            {headline ? (
              <p
                className={cn(
                  "mt-1 text-lg font-semibold leading-tight tracking-tight",
                  isAttention ? "text-destructive" : "text-foreground"
                )}
              >
                {headline}
              </p>
            ) : null}
            {description ? (
              <p
                className={cn(
                  headline
                    ? "mt-1 text-sm text-muted-foreground"
                    : "mt-0.5 text-xs text-foreground/70"
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children ? (
        <div
          className={cn(
            "flex-1 px-5 pb-5 pt-4",
            emphasis && isAttention && "bg-destructive/[0.035]",
            bodyClassName
          )}
        >
          {children}
        </div>
      ) : (
        <div className={cn("pb-5", emphasis && isAttention && "bg-destructive/[0.035]")} />
      )}

      {/* Actions belong to the state they resolve, banded so they read as the
          surface's conclusion rather than as another row inside it. */}
      {footer ? (
        <div className="border-t border-border bg-muted/40 px-5 py-3">{footer}</div>
      ) : null}
    </section>
  );
}

/**
 * What the tenant does not yet have. Dashed and untinted, so an area waiting on
 * a capability never competes with an area carrying a fact — and so a record
 * full of held places still reads as a working product rather than a broken one.
 */
export function SupportingSurface({
  id,
  title,
  description,
  icon,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        // A light tint only: at 25% the panel darkened enough to drop muted
        // text below AA, and the dashed border plus absent shadow already
        // separate this level from a solid card.
        "flex flex-col rounded-2xl border border-dashed border-border bg-muted/15 px-5 py-4"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? <IconTile icon={icon} size="sm" className="bg-muted" /> : null}
          <div className="min-w-0">
            <h2 id={id} className="text-sm font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-foreground/70">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children ? <div className="mt-3.5 flex-1">{children}</div> : null}
    </section>
  );
}

export type StatusTone = "default" | "muted" | "positive" | "attention";

const STATUS_TONE: Record<StatusTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  positive: "text-emerald-700 dark:text-emerald-400",
  attention: "text-destructive",
};

/**
 * A fact worth reading, stacked so the answer outweighs the question.
 *
 * The label-left/value-right row this replaces gave equal weight to both, which
 * made a page of state look like a settings table. Here the value carries the
 * size and the label recedes to a caption.
 *
 * It emits `dt`/`dd`, so it is only valid inside `StatusGrid` — which is the
 * `dl` those elements need. Rendering one in a bare `div` leaves orphaned
 * definition terms that assistive tech cannot associate with anything.
 */
export function StatusBlock({
  label,
  value,
  tone = "default",
  hint,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  tone?: StatusTone;
  hint?: string;
  /** Takes the whole row, for a fact the others are subordinate to. */
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-full")}>
      <dt className="text-xs text-foreground/70">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[0.9375rem] font-semibold leading-6 [overflow-wrap:anywhere]",
          STATUS_TONE[tone]
        )}
      >
        {value}
        {/* Inside the `dd` rather than beside it: a `div` grouping a `dl`'s
            children may hold only `dt` and `dd`, and `dd` takes flow content. */}
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-foreground/70">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** The `dl` every `StatusBlock` must sit inside. */
export function StatusGrid({
  children,
  columns = 2,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 4
          ? "grid-cols-2 lg:grid-cols-4"
          : columns === 3
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : columns === 1
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      {children}
    </dl>
  );
}

/**
 * A single fact given its own small surface, because it is the subject of the
 * area it sits in rather than one row among several.
 *
 * `as="li"` where the caller is building a list; the wrapper is the only thing
 * that ever differed between the two places this shape was written out.
 */
export function FactTile({
  icon,
  label,
  value,
  as: Wrapper = "div",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  as?: "div" | "li";
}) {
  return (
    <Wrapper className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3">
      <IconTile icon={icon} size="sm" className="bg-background" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {/* Wraps rather than truncates: a clipped value cannot be checked. */}
        <p className="text-[0.9375rem] font-semibold leading-6 text-foreground [overflow-wrap:anywhere]">
          {value}
        </p>
      </div>
    </Wrapper>
  );
}

/**
 * A deliberate nothing-here state. Used where a destination is real but this
 * particular tenant has produced no content for it, which must not look like a
 * failure or an unfinished page.
 */
export function RecordEmpty({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** A summary has less room to spend on an absence than its destination. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-4 text-center",
        compact ? "py-6" : "py-10"
      )}
    >
      <IconTile icon={Icon} className="size-10" />
      <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
