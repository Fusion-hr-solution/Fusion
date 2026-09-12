"use client";

import type { ContinuityState, TenantAccessSummaryDto } from "@repo/api";
import { Button, cn } from "@repo/ds";
import { Users } from "lucide-react";
import {
  CONTINUITY_ADVISORY,
  CONTINUITY_LABEL,
} from "./access-language";

/**
 * The page's opening judgment: whether the tenant is safely administered.
 *
 * The posture and the three live counts sit on one line so an administrator reads
 * the state of continuity before the roster beneath it. The advisory sentence
 * appears only when continuity actually needs attention — a healthy tenant is
 * confirmed by the numbers, not by a caption.
 */

const POSTURE_TEXT: Record<ContinuityState, string> = {
  Healthy: "text-success",
  AtRisk: "text-warning",
  RecoveryRequired: "text-destructive",
};

const POSTURE_DOT: Record<ContinuityState, string> = {
  Healthy: "bg-success",
  AtRisk: "bg-warning",
  RecoveryRequired: "bg-destructive",
};

const POSTURE_SURFACE: Record<ContinuityState, string> = {
  Healthy: "border-border bg-muted/30",
  AtRisk: "border-warning/30 bg-warning-subtle/50",
  RecoveryRequired: "border-destructive/30 bg-destructive/5",
};

export function ContinuityBanner({
  summary,
  canManage,
  onInvite,
}: {
  summary: TenantAccessSummaryDto;
  canManage: boolean;
  onInvite: () => void;
}) {
  const advisory = CONTINUITY_ADVISORY[summary.continuity];

  return (
    <section
      aria-label="Administrative continuity"
      className={cn(
        "flex flex-col gap-6 rounded-2xl border p-5 lg:flex-row lg:items-center lg:gap-8",
        POSTURE_SURFACE[summary.continuity]
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground ring-1 ring-border"
        >
          <Users className="size-5" />
        </span>

        <div className="min-w-0 space-y-1">
          <p className="type-eyebrow text-muted-foreground">Administrative continuity</p>
          <p className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", POSTURE_DOT[summary.continuity])}
            />
            <span className={cn("type-section-title", POSTURE_TEXT[summary.continuity])}>
              {CONTINUITY_LABEL[summary.continuity]}
            </span>
          </p>
          {advisory ? (
            <p className="type-meta max-w-prose text-muted-foreground">{advisory}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 lg:justify-end lg:gap-8">
        <div className="flex items-center gap-6 lg:gap-8 lg:border-l lg:pl-8">
          <Stat label="Active" value={summary.activeAdministrators} dot="bg-success" />
          <Stat label="Pending" value={summary.pendingInvitations} dot="bg-warning" />
          <Stat
            label="Suspended"
            value={summary.suspendedAdministrators}
            dot="bg-muted-foreground/50"
          />
        </div>

        {canManage ? (
          <Button className="w-full shrink-0 sm:w-auto" onClick={onInvite}>
            Invite administrator
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="min-w-0">
      <p className="type-metric tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 flex items-center gap-1.5 type-meta text-muted-foreground">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        {label}
      </p>
    </div>
  );
}
