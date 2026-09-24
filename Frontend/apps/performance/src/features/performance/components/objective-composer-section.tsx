import type { ReactNode } from "react";

/**
 * The numbered vertical section shared by every objective composer — strategic, organizational, and
 * employee plan. It owns only the section's identity (number, title, optional hint) and the spacing
 * between the heading and its body; each composer keeps its own body layout by passing children
 * directly, or an inner spacing via `bodyClassName` (organizational and strategic group their fields
 * with `space-y-4`; the plan composer spaces its own children through the section itself).
 */
export function ObjectiveComposerSection({
  n,
  title,
  hint,
  bodyClassName,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  /** Wraps the body in a spacing container when set — omit to let the section space children directly. */
  bodyClassName?: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {n}. {title}
        </h3>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </section>
  );
}
