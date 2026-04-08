import { cn } from "@/lib/utils";

/**
 * Fusion **Core** app UI layer — field + CTA tokens built on `@repo/ui` / shadcn.
 * Platform admin was designed first; these classes are the foundation for other Core features.
 *
 * Scope design tokens with `.core-ui-root` (see `globals.css`) where possible.
 */
export const coreFieldClassName = cn(
  "w-full rounded-ch-md border border-ch-outline-variant/25 bg-ch-surface px-3.5 py-2.5 text-sm text-ch-on-surface shadow-sm",
  "placeholder:text-stone-400",
  "transition-shadow",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface",
  "disabled:cursor-not-allowed disabled:opacity-80"
);

export const coreFieldReadOnlyClassName = cn(
  coreFieldClassName,
  "cursor-not-allowed border-transparent bg-ch-surface-container-low text-ch-on-surface-variant/80 shadow-none",
  "focus-visible:ring-0 focus-visible:ring-offset-0"
);

/** Primary actions — fixed height so all Core flows stay visually aligned */
export const corePrimaryButtonClassName = cn(
  "inline-flex !h-auto min-h-12 w-full items-center justify-center gap-2 rounded-ch-md border-transparent px-8 py-3",
  "font-chHeadline text-sm font-bold leading-none",
  "bg-ch-primary-container text-ch-on-primary-container shadow-sm",
  "transition-colors",
  "hover:bg-ch-primary-fixed-dim hover:text-ch-on-primary-container",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface",
  "disabled:pointer-events-none disabled:opacity-60",
  "sm:w-auto"
);
