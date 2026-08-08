import { cn } from "../lib/utils";

/**
 * Shared state language for Core + Performance. Tones are deliberately restrained:
 * - neutral: ordinary/default states            - info: in-flight/active
 * - success: completed/healthy                  - warning: attention/pending (yellow)
 * - danger: destructive/error/seriously overdue - muted: inactive/archived
 * Red is reserved for danger; yellow means attention/pending.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-foreground/80",
  info: "border-transparent bg-info-subtle text-info",
  success: "border-transparent bg-success-subtle text-success",
  warning: "border-transparent bg-warning-subtle text-warning",
  danger: "border-transparent bg-destructive/12 text-destructive",
  muted: "border-border bg-transparent text-muted-foreground",
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  /** Show a leading dot for at-a-glance scanning. */
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ tone = "neutral", children, dot = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}
