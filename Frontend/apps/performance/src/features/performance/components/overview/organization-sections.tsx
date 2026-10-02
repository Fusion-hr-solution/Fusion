"use client";

import type { CycleSummaryDto, CyclePlanSummaryDto } from "@repo/api";
import { ChevronRight } from "@/lib/icons";
import { cn } from "@repo/ds/lib/utils";
import { useCycle, useCyclePlanSummary, useGoals, useMyPlan } from "../../api/use-performance";
import { formatDate, formatDateRange } from "../../lib";
import { LaunchReadiness } from "../launch-readiness";
import { MilestoneRail } from "../milestone-rail";
import { deriveSetupState, earliestIncompleteStep, setupStepHref } from "../cycle-setup/setup-readiness";
import { useObjectiveRecord } from "../objective-record/use-objective-record";
import { localToday } from "./overview-model";
import { Facts, Headline, OverviewSection, ProgressLine, SectionAction, SectionSkeleton } from "./overview-primitives";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The company direction this cycle executes, each objective opening in the record. */
export function OrgDirectionSection({ cycle }: { cycle: CycleSummaryDto }) {
  const goals = useGoals(cycle.id);
  const record = useObjectiveRecord();
  const roots = (goals.data?.nodes ?? []).filter(
    (node) => node.ownershipScope === "Company" && node.state === "Published"
  );

  return (
    <OverviewSection label="Organization direction" action={<SectionAction href="/goals">Open organization direction</SectionAction>}>
      {goals.isLoading ? (
        <SectionSkeleton />
      ) : roots.length === 0 ? (
        <Headline muted>No company direction is published for this cycle</Headline>
      ) : (
        <ul className="-mx-3">
          {roots.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => record.open({ cycleId: cycle.id, objectiveId: node.id })}
                className="group flex w-full items-center gap-4 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="type-panel-title block truncate text-foreground">{node.title}</span>
                  <span className="type-meta text-muted-foreground">
                    {node.childCount > 0 ? `${plural(node.childCount, "aligned objective")}` : "No aligned objectives yet"}
                    {node.accountablePersonName ? ` · ${node.accountablePersonName}` : ""}
                  </span>
                </span>
                <ProgressLine value={node.derivedProgress} has={node.hasProgress} className="w-48 shrink-0" />
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </OverviewSection>
  );
}

// The distribution's order and tone: settled plans first, then what is waiting, then what has not begun.
const DISTRIBUTION: { key: keyof CyclePlanSummaryDto; label: string; fill: string }[] = [
  { key: "approvedCount", label: "approved", fill: "bg-success" },
  { key: "submittedCount", label: "awaiting decision", fill: "bg-primary" },
  { key: "returnedForChangesCount", label: "returned", fill: "bg-info" },
  { key: "draftCount", label: "drafting", fill: "bg-muted-foreground/60" },
  { key: "notStartedCount", label: "not started", fill: "bg-muted-foreground/25" },
];

/**
 * How planning and execution are going across the cycle — counts and exceptions administration acts on.
 * Deliberately no averaged progress: plans are not comparable enough for an average to mean anything.
 */
export function PlanningOperationSection({ cycle }: { cycle: CycleSummaryDto }) {
  const summary = useCyclePlanSummary(cycle.id);
  const detail = useCycle(cycle.id);
  const s = summary.data;

  return (
    <OverviewSection label="Planning and execution" action={<SectionAction href="/cycle">Manage cycle</SectionAction>}>
      {summary.isLoading || !s ? (
        summary.error ? <Headline muted>Plan standing could not be loaded</Headline> : <SectionSkeleton />
      ) : s.participantCount === 0 ? (
        <Headline muted>No participants in this cycle</Headline>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="type-metric text-foreground">
              {s.approvedCount}
              <span className="text-muted-foreground"> / {s.participantCount}</span>
            </span>
            <span className="text-sm text-muted-foreground">plans approved</span>
          </p>
          <Distribution summary={s} />
          {/* The distribution already counts every plan by state; the facts carry execution only. */}
          <Facts
            facts={[
              s.approvedCount > 0
                ? {
                    label: `${s.approvedReportingCount} of ${s.approvedCount} approved plans reporting`,
                    tone: s.approvedNotReportingCount > 0 ? "attention" : "default",
                  }
                : null,
              s.participantsWithOverdueMilestones > 0
                ? { label: `${plural(s.participantsWithOverdueMilestones, "plan")} with overdue milestones`, tone: "critical" }
                : null,
            ]}
          />
          {detail.data ? (
            <div className="mt-5 max-w-3xl">
              <MilestoneRail milestones={detail.data.milestones} />
            </div>
          ) : null}
        </>
      )}
    </OverviewSection>
  );
}

function Distribution({ summary }: { summary: CyclePlanSummaryDto }) {
  const parts = DISTRIBUTION.map((part) => ({ ...part, count: summary[part.key] as number })).filter((part) => part.count > 0);
  const label = parts.map((part) => `${part.count} ${part.label}`).join(", ");
  return (
    <div className="mt-3 max-w-3xl">
      <div role="img" aria-label={label} className="flex h-2 gap-1">
        {parts.map((part) => (
          <span key={part.key} className={cn("h-full rounded-full", part.fill)} style={{ flexGrow: part.count, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        {parts.map((part) => (
          <li key={part.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", part.fill)} />
            <span className="tabular-nums text-foreground">{part.count}</span> {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A cycle still being set up: what is ready, and the step that comes next. */
export function SetupSection({ cycle }: { cycle: CycleSummaryDto }) {
  const detail = useCycle(cycle.id);
  const next = detail.data ? setupStepHref(earliestIncompleteStep(deriveSetupState(detail.data))) : "/cycle/setup";
  return (
    <OverviewSection label="Cycle setup" attention action={<SectionAction href={next} primary>Continue setup</SectionAction>}>
      <Headline attention>{cycle.name} is being set up</Headline>
      <Facts facts={[{ label: formatDateRange(cycle.startDate, cycle.endDate) }]} />
      {detail.data ? (
        <div className="mt-4 max-w-3xl">
          <LaunchReadiness readiness={detail.data.launchReadiness} />
        </div>
      ) : null}
    </OverviewSection>
  );
}

/**
 * The most recent cycle, once it has closed and nothing is running: what it came to, so Overview tells
 * the story of the system instead of going blank. Results and reviews will be reached from here.
 */
export function ClosedCycleSection({
  cycle,
  canAdminister,
  canParticipate,
  canCreateNext,
}: {
  cycle: CycleSummaryDto;
  canAdminister: boolean;
  canParticipate: boolean;
  canCreateNext: boolean;
}) {
  const summary = useCyclePlanSummary(cycle.id, canAdminister);
  const my = useMyPlan(cycle.id, canParticipate);
  const plan = my.data?.plan;

  return (
    <OverviewSection
      label="Most recent cycle"
      action={canCreateNext ? <SectionAction href="/cycle/setup/details" primary>Create next cycle</SectionAction> : undefined}
    >
      <Headline>{cycle.name} has closed</Headline>
      <Facts
        facts={[
          { label: formatDateRange(cycle.startDate, cycle.endDate) },
          summary.data && summary.data.participantCount > 0
            ? { label: `${summary.data.approvedCount} of ${plural(summary.data.participantCount, "plan")} approved` }
            : null,
          plan?.state === "Approved" ? { label: `Your plan closed at ${Math.round(plan.planProgress)}%` } : null,
        ]}
      />
    </OverviewSection>
  );
}

/** Nothing has run yet: administration starts the first cycle; everyone else is told plainly. */
export function NoCycleSection({ canAdminister }: { canAdminister: boolean }) {
  return (
    <OverviewSection
      label="Performance cycle"
      attention={canAdminister}
      action={canAdminister ? <SectionAction href="/cycle/setup/details" primary>Create cycle</SectionAction> : undefined}
    >
      <Headline attention={canAdminister} muted={!canAdminister}>
        {canAdminister ? "No performance cycle yet" : "There is no active performance cycle"}
      </Headline>
    </OverviewSection>
  );
}

/** For someone with no section of their own in a running cycle: its state, and nothing invented. */
export function CycleStatusSection({ cycle }: { cycle: CycleSummaryDto }) {
  const planningOpen = cycle.planningDeadline.slice(0, 10) >= localToday();
  return (
    <OverviewSection label="Performance cycle">
      <Headline>{cycle.name} is running</Headline>
      <Facts
        facts={[
          planningOpen ? { label: `Planning open until ${formatDate(cycle.planningDeadline)}` } : null,
          { label: `Ends ${formatDate(cycle.endDate)}` },
        ]}
      />
    </OverviewSection>
  );
}
