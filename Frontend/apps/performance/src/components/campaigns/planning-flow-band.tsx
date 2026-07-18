"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import { campaignPlanningFlow as t } from "./campaign-terminology";
import {
  useCampaignHandoff,
  type CampaignHandoff,
} from "./use-campaign-handoff";

type StageTone = "pending" | "progress" | "done" | "blocked" | "muted";

interface StageView {
  key: string;
  index: number;
  label: string;
  href: string | null;
  primary: string;
  meter: number | null;
  tone: StageTone;
  isLoading: boolean;
}

export interface PlanningFlowBandAccess {
  /** Operable-workspace gates (drive whether a stage links, never whether it shows state). */
  canViewStrategy: boolean;
  canAccessTeam: boolean;
  canAccessMine: boolean;
  canAccessApprovals: boolean;
  canViewCompletion: boolean;
  /** Read-model gates (drive whether a stage can show live counts at all). */
  canReadCascade: boolean;
  canReadCompletion: boolean;
}

export function PlanningFlowBand({
  slug,
  planningOpeningDate,
  locked,
  access,
}: {
  slug: string;
  planningOpeningDate: string | null;
  locked: boolean;
  access: PlanningFlowBandAccess;
}) {
  const handoff = useCampaignHandoff(slug, {
    canReadCascade: access.canReadCascade,
    canReadCompletion: access.canReadCompletion,
  });

  const stages = buildStages(slug, planningOpeningDate, locked, access, handoff);
  if (stages.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {stages.map((stage) => (
          <StageTile key={stage.key} stage={stage} />
        ))}
      </ol>
    </section>
  );
}

const TONE_METER: Record<StageTone, string> = {
  done: "bg-primary",
  progress: "bg-primary/55",
  blocked: "bg-destructive",
  pending: "bg-muted-foreground/40",
  muted: "bg-border",
};

const TONE_DOT: Record<StageTone, string> = {
  done: "bg-primary",
  progress: "bg-primary/70",
  blocked: "bg-destructive",
  pending: "bg-muted-foreground/50",
  muted: "bg-muted-foreground/30",
};

function StageTile({ stage }: { stage: StageView }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span
            className={cn("size-1.5 rounded-full", TONE_DOT[stage.tone])}
            aria-hidden
          />
          <span className="tabular-nums">{stage.index}</span>
          <span className="truncate">{stage.label}</span>
        </span>
        {stage.href ? (
          <ArrowRight
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 truncate font-heading text-lg font-semibold tracking-tight tabular-nums",
          stage.tone === "muted" || stage.tone === "pending"
            ? "text-muted-foreground"
            : "text-foreground",
          stage.isLoading && "animate-pulse text-muted-foreground",
        )}
      >
        {stage.isLoading ? "…" : stage.primary}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        {stage.meter !== null ? (
          <span
            className={cn("block h-full rounded-full", TONE_METER[stage.tone])}
            style={{ width: `${Math.round(clamp01(stage.meter) * 100)}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </>
  );

  const shell =
    "group flex min-w-0 flex-col rounded-xl border border-border bg-background px-3 py-3";

  if (stage.href) {
    return (
      <li className="min-w-0">
        <Link
          href={stage.href}
          className={cn(
            shell,
            "transition-colors hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <div className={shell}>{body}</div>
    </li>
  );
}

function buildStages(
  slug: string,
  planningOpeningDate: string | null,
  locked: boolean,
  access: PlanningFlowBandAccess,
  handoff: CampaignHandoff,
): StageView[] {
  const cascade = handoff.cascade;
  const completion = handoff.completion;
  const cov = cascade.data;
  const comp = completion.data;

  // A launched campaign whose planning window has not opened yet must not read as
  // "employees can plan now" — the Employee plans stage points to the opening date.
  const planningNotYetOpen =
    !!planningOpeningDate && new Date(planningOpeningDate).getTime() > Date.now();

  const activeParticipants = comp
    ? comp.summary.totalParticipants - comp.summary.excludedCount
    : 0;
  const reachedSubmission = comp
    ? comp.summary.submittedCount +
      comp.summary.changesRequestedCount +
      comp.summary.approvedCount
    : 0;

  const strategy: StageView = {
    key: "strategy",
    index: 1,
    label: t.stages.strategy,
    href: access.canViewStrategy ? `/strategy/${slug}` : null,
    isLoading: cascade.available && cascade.isLoading,
    ...strategyState(cov),
  };

  const team: StageView = {
    key: "team",
    index: 2,
    label: t.stages.team,
    href: access.canAccessTeam ? `/team-objectives/${slug}` : null,
    isLoading: cascade.available && cascade.isLoading,
    ...teamState(cov),
  };

  const employeePlans: StageView = {
    key: "employee-plans",
    index: 3,
    label: t.stages.employeePlans,
    href: access.canAccessMine ? `/my-objectives/${slug}` : null,
    isLoading: completion.available && completion.isLoading,
    ...employeePlanState(
      comp,
      planningNotYetOpen,
      planningOpeningDate,
      activeParticipants,
      reachedSubmission,
    ),
  };

  const approvals: StageView = {
    key: "approvals",
    index: 4,
    label: t.stages.approvals,
    href: access.canAccessApprovals ? `/plan-approvals/${slug}` : null,
    isLoading: completion.available && completion.isLoading,
    ...approvalState(comp, reachedSubmission),
  };

  const completionStage: StageView = {
    key: "completion",
    index: 5,
    label: t.stages.completion,
    href: access.canViewCompletion ? `/campaigns/${slug}/completion` : null,
    isLoading: completion.available && completion.isLoading,
    ...completionState(comp, locked, activeParticipants),
  };

  return [strategy, team, employeePlans, approvals, completionStage];
}

type StageState = Pick<StageView, "primary" | "meter" | "tone">;

function strategyState(cov: CampaignHandoff["cascade"]["data"]): StageState {
  if (!cov) return { primary: t.none, meter: null, tone: "muted" };
  const { coveredStrategicObjectiveCount: covered, activeStrategicObjectiveCount: total } =
    cov;
  if (total === 0) return { primary: t.none, meter: null, tone: "muted" };
  const done = covered >= total;
  return {
    primary: done ? t.allCovered : t.covered(covered, total),
    meter: covered / total,
    tone: done ? "done" : "progress",
  };
}

function teamState(cov: CampaignHandoff["cascade"]["data"]): StageState {
  if (!cov) return { primary: t.none, meter: null, tone: "muted" };
  const { managersWithTeamObjectivesCount: withObjectives, managerCount: total } = cov;
  if (total === 0) return { primary: t.none, meter: null, tone: "muted" };
  const done = withObjectives >= total;
  return {
    primary: t.managersWithObjectives(withObjectives, total),
    meter: withObjectives / total,
    tone: done ? "done" : "progress",
  };
}

function employeePlanState(
  comp: CampaignHandoff["completion"]["data"],
  planningNotYetOpen: boolean,
  planningOpeningDate: string | null,
  activeParticipants: number,
  reachedSubmission: number,
): StageState {
  if (planningNotYetOpen) {
    return {
      primary: t.opensOn(formatDate(planningOpeningDate)),
      meter: null,
      tone: "pending",
    };
  }
  if (!comp || activeParticipants === 0) {
    return { primary: t.none, meter: null, tone: "muted" };
  }
  const done = reachedSubmission >= activeParticipants;
  return {
    primary: t.submitted(reachedSubmission, activeParticipants),
    meter: reachedSubmission / activeParticipants,
    tone: done ? "done" : "progress",
  };
}

function approvalState(
  comp: CampaignHandoff["completion"]["data"],
  reachedSubmission: number,
): StageState {
  if (!comp) return { primary: t.none, meter: null, tone: "muted" };
  const awaiting = comp.summary.submittedCount;
  const approved = comp.summary.approvedCount;
  const meter = reachedSubmission > 0 ? approved / reachedSubmission : 0;
  if (awaiting > 0) {
    return { primary: t.awaitingReview(awaiting), meter, tone: "progress" };
  }
  if (approved > 0) {
    return { primary: t.approved(approved), meter, tone: "done" };
  }
  return { primary: t.none, meter: null, tone: "muted" };
}

function completionState(
  comp: CampaignHandoff["completion"]["data"],
  locked: boolean,
  activeParticipants: number,
): StageState {
  if (locked) return { primary: t.locked, meter: 1, tone: "done" };
  if (!comp) return { primary: t.none, meter: null, tone: "muted" };
  const { remainingCount, blockedCount, approvedCount, isReadyToLock } = comp.summary;
  const meter = activeParticipants > 0 ? approvedCount / activeParticipants : 0;
  if (isReadyToLock) return { primary: t.readyToLock, meter, tone: "done" };
  if (blockedCount > 0) return { primary: t.blocked(blockedCount), meter, tone: "blocked" };
  return { primary: t.remaining(remainingCount), meter, tone: "progress" };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
