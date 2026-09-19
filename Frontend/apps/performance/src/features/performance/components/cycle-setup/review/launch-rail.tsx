"use client";

import type { ReactNode } from "react";
import {
  CalendarCheck2,
  Check,
  ClipboardList,
  Info,
  Lock,
  Megaphone,
  Play,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import type { CycleDetailDto, PopulationDto } from "@repo/api";
import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "../../../lib";

/**
 * The launch rail: the authoritative go/no-go readout beside the summary. Blockers become a list of
 * satisfied (or failing) checks; the things that deliberately are not launch prerequisites are named
 * so their absence never reads as an oversight; and the irreversible consequences of launching are
 * stated once, plainly, where the decision is made.
 */

interface Check {
  ok: boolean;
  label: string;
  detail?: string;
}

function deriveChecks(detail: CycleDetailDto, population: PopulationDto): Check[] {
  const c = detail.cycle;
  const datesValid =
    detail.launchReadiness.areas.find((a) => a.key === "details")?.complete ?? true;
  const required = population.reviewerRequiredCount;
  const reviewersResolved = required === 0 || population.reviewerReadyCount >= required;

  return [
    { ok: c.state === "Draft", label: "Cycle is in draft state" },
    { ok: !detail.otherActiveCycleExists, label: "No other cycle is active" },
    {
      ok: datesValid,
      label: "Cycle dates are valid",
      detail: `${formatDate(c.startDate)} – ${formatDate(c.endDate)} · plans due ${formatDate(c.planningDeadline)}`,
    },
    {
      ok: detail.populationConfirmed && reviewersResolved,
      label: "Population is confirmed",
      detail: `${detail.confirmedParticipantCount} participants, all with reviewers`,
    },
  ];
}

function RailCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">{children}</section>
  );
}

function RailHeading({ children }: { children: ReactNode }) {
  return <h2 className="type-panel-title text-foreground">{children}</h2>;
}

export function LaunchReadinessPanel({
  detail,
  population,
}: {
  detail: CycleDetailDto;
  population: PopulationDto;
}) {
  const checks = deriveChecks(detail, population);
  const ready = checks.every((check) => check.ok);

  const notRequired: Check[] = [
    {
      ok: true,
      label: "Strategic direction",
      detail:
        detail.publishedStrategyCount > 0
          ? `${detail.publishedStrategyCount} objective${detail.publishedStrategyCount === 1 ? "" : "s"} published`
          : "Can be established after launch",
    },
    { ok: true, label: "Employee plans", detail: "Created as participants begin planning" },
    { ok: true, label: "Communications", detail: "No notifications are sent at launch" },
  ];

  const notRequiredIcons = [Target, ClipboardList, Megaphone];

  return (
    <RailCard>
      <div className="flex items-center justify-between gap-3">
        <RailHeading>Launch readiness</RailHeading>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            ready ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
          )}
        >
          {ready ? <ShieldCheck className="size-3" aria-hidden /> : null}
          {ready ? "Ready" : "Not ready"}
        </span>
      </div>

      <ul className="mt-4 space-y-3.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                check.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
              aria-hidden
            >
              {check.ok ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className="min-w-0">
              <span className="block type-body-secondary font-medium text-foreground">
                {check.label}
              </span>
              {check.detail ? (
                <span
                  className={cn(
                    "mt-0.5 block type-meta",
                    check.ok ? "text-muted-foreground" : "text-destructive"
                  )}
                >
                  {check.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-border/70 pt-5">
        <p className="type-eyebrow text-muted-foreground">Not required to launch</p>
        <ul className="mt-3 space-y-3">
          {notRequired.map((item, i) => {
            const Icon = notRequiredIcons[i] ?? Info;
            return (
              <li key={item.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-3" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block type-body-secondary text-foreground">{item.label}</span>
                  <span className="mt-0.5 block type-meta text-muted-foreground">{item.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </RailCard>
  );
}

const CONSEQUENCES: { icon: typeof Play; label: string; detail: string }[] = [
  { icon: Play, label: "The cycle goes live", detail: "Participants can begin planning." },
  { icon: Lock, label: "Details lock", detail: "The cycle and policy can no longer be changed." },
  {
    icon: CalendarCheck2,
    label: "The roster is fixed",
    detail: "The confirmed population becomes final.",
  },
];

export function LaunchConsequences() {
  return (
    <RailCard>
      <RailHeading>When you launch</RailHeading>
      <ul className="mt-4 space-y-4">
        {CONSEQUENCES.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block type-body-secondary font-medium text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block type-meta text-muted-foreground">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}
