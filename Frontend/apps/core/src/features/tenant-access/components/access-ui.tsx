"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  cn,
} from "@repo/ds";
import { Mail } from "lucide-react";
import type { AccessTone } from "./access-language";

/**
 * The small visual vocabulary Access is built from.
 *
 * Deliberately not badges: a page whose whole job is a list of people reads
 * better when status is a quiet mark beside a name than when every row carries a
 * filled pill competing with the name for attention. The label is always present,
 * so the colour is reinforcement rather than the message.
 */

const DOT_TONE: Record<AccessTone, string> = {
  neutral: "bg-muted-foreground",
  positive: "bg-emerald-600 dark:bg-emerald-500",
  caution: "bg-amber-500",
  muted: "bg-muted-foreground/40",
};

const TEXT_TONE: Record<AccessTone, string> = {
  neutral: "text-foreground",
  positive: "text-foreground",
  caution: "text-foreground",
  muted: "text-muted-foreground",
};

export function StatusMark({
  tone,
  children,
  className,
}: {
  tone: AccessTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", TEXT_TONE[tone], className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT_TONE[tone])} />
      {children}
    </span>
  );
}

/**
 * Identity mark. A person gets their initials; an invitation gets an envelope,
 * because an invited address is not yet a person in this tenant and should not
 * be dressed as one.
 */
export function IdentityMark({ name, invitation }: { name?: string; invitation?: boolean }) {
  if (invitation) {
    return (
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground"
      >
        <Mail className="size-4" />
      </span>
    );
  }

  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
    >
      {initials || "—"}
    </span>
  );
}

/** Names the person a confirmation is about, so the decision is never abstract. */
export function SubjectCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5">
      <IdentityMark name={title} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** The consequence of this decision only — never the whole rule set. */
  consequence: string;
  subject?: { title: string; subtitle: string };
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  problem?: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  consequence,
  subject,
  confirmLabel,
  destructive = false,
  busy = false,
  problem = null,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Width is left to the design system: its own data-size rule outranks a
          local max-width, so setting one here only overflows the content. */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>

        {subject ? <SubjectCard title={subject.title} subtitle={subject.subtitle} /> : null}

        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            variant={destructive ? "destructive" : "default"}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
