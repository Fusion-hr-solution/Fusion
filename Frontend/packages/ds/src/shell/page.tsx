import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Wider container for dense tables/workbenches. */
  width?: "default" | "wide" | "narrow";
}

const WIDTHS: Record<NonNullable<PageContainerProps["width"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[1400px]",
};

/** Consistent page padding + max-width so every Core/Perf page shares one rhythm. */
export function PageContainer({ children, className, width = "default" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-6 py-6", WIDTHS[width], className)}>{children}</div>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Primary + secondary actions, right-aligned. */
  actions?: ReactNode;
  /** Status badge / eyebrow shown above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

/** Standard enterprise page header: eyebrow, title, description, and right-aligned actions. */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
        <h1 className="text-[1.4rem] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {description ? (
          typeof description === "string" ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : (
            // Element descriptions (e.g. skeleton placeholders) may contain
            // block content, which is invalid inside <p>.
            <div className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</div>
          )
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface PageToolbarProps {
  children: ReactNode;
  className?: string;
}

/** Filter / scope control strip that sits between the header and the main content. */
export function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-3", className)}>{children}</div>
  );
}
