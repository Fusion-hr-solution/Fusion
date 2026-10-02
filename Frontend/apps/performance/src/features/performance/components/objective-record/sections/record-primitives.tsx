import type { ReactNode } from "react";
import { cn } from "@repo/ds/lib/utils";

/** The neutral icon tile the record's cards lead with. */
export const RECORD_ICON_TINT = "bg-inlay text-muted-foreground ring-border dark:bg-popover";

/** A titled detail card: an icon tile, a title, and a subtitle above caller content — the record's unit. */
export function RecordCard({
  icon,
  iconTint = RECORD_ICON_TINT,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  iconTint?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-surface border border-border bg-popover p-4 dark:bg-card">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-control ring-1", iconTint)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

/** A fact inside a card: an icon disc beside a labelled value, values allowed to wrap within the tile. */
export function MiniFact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-surface border border-border bg-inlay p-3.5 dark:bg-popover">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground dark:bg-card">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="type-eyebrow text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-medium leading-snug text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

/** A labelled section: an eyebrow over its content, the record's repeating rhythm. */
export function RecordSection({ label, action, children }: { label: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <p className="type-eyebrow text-muted-foreground">{label}</p>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The plain content surface sections place their body on. */
export const RECORD_SURFACE = "rounded-surface border border-border bg-popover p-4 dark:bg-card";
