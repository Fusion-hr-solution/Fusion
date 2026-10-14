"use client";

import type { CyclePlanSummaryDto, OverviewSectionDto } from "@repo/api";
import { cn } from "@repo/ds/lib/utils";
import { formatDate, formatDateRange } from "../../lib";
import { LaunchReadiness } from "../launch-readiness";
import { MilestoneRail } from "../milestone-rail";
import { deriveSetupState, earliestIncompleteStep, setupStepHref } from "../cycle-setup/setup-readiness";
import { overviewHref, plural } from "./overview-model";
import { ObjectiveList } from "./personal-sections";
import { Facts, Headline, OverviewSection, SectionAction } from "./overview-primitives";

type Section<K extends OverviewSectionDto["kind"]> = Extract<OverviewSectionDto, { kind: K }>;

/** A small signal of the company direction this Cycle executes, each objective opening in the record. */
export function DirectionSection({ section, cycleId }: { section: Section<"direction">; cycleId: string }) {
  return (
    <OverviewSection
      label="Organization direction"
      action={<SectionAction href={overviewHref(section.destination)}>Open organization direction</SectionAction>}
    >
      {section.publishedCount === 0 ? (
        <Headline muted>No company direction is published for this cycle</Headline>
      ) : (
        <ObjectiveList
          objectives={section.objectives}
          cycleId={cycleId}
          describe={(node) =>
            `${node.childCount > 0 ? plural(node.childCount, "aligned objective") : "No aligned objectives yet"}${
              node.accountablePersonName ? ` · ${node.accountablePersonName}` : ""
            }`
          }
        />
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
 * How planning and execution are going across the Cycle — counts and exceptions administration acts on.
 * Deliberately no averaged progress: plans are not comparable enough for an average to mean anything.
 */
export function CycleOperationSection({ section }: { section: Section<"cycleOperation"> }) {
  const s = section.summary;
  return (
    <OverviewSection
      label="Planning and execution"
      action={<SectionAction href={overviewHref(section.destination)}>Manage cycle</SectionAction>}
    >
      {s.participantCount === 0 ? (
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
              s.participantsWithOverdueObjectives > 0
                ? { label: `${plural(s.participantsWithOverdueObjectives, "plan")} with overdue objectives`, tone: "critical" }
                : null,
            ]}
          />
          <div className="mt-5 max-w-3xl">
            <MilestoneRail milestones={section.milestones} />
          </div>
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

/** A Cycle still being set up: what is ready, and the step that comes next. */
export function SetupSection({ section }: { section: Section<"setupReadiness"> }) {
  const cycle = section.detail.cycle;
  const next = setupStepHref(earliestIncompleteStep(deriveSetupState(section.detail)));
  return (
    <OverviewSection label="Cycle setup" attention action={<SectionAction href={next} primary>Continue setup</SectionAction>}>
      <Headline attention>{cycle.name} is being set up</Headline>
      <Facts facts={[{ label: formatDateRange(cycle.startDate, cycle.endDate) }]} />
      <div className="mt-4 max-w-3xl">
        <LaunchReadiness readiness={section.detail.launchReadiness} />
      </div>
    </OverviewSection>
  );
}

/**
 * A Cycle that has closed: what it came to, so Overview tells the story of the system instead of going
 * blank, and — for administration — what comes next.
 */
export function ClosedCycleSection({ section }: { section: Section<"closedCycle"> }) {
  const next = section.next;
  return (
    <OverviewSection
      label="Closed cycle"
      action={<div className="flex items-center gap-1">
        {section.reviews ? <SectionAction href={overviewHref(section.reviews)}>View results</SectionAction> : null}
        {next ? (
          <SectionAction href={overviewHref(next)} primary>
            {next.workspace === "CycleSetup" ? "Continue setup" : "Create next cycle"}
          </SectionAction>
        ) : (
          <SectionAction href={overviewHref(section.view)}>View cycle</SectionAction>
        )}
      </div>}
    >
      <Headline>{section.cycle.name} has closed</Headline>
      <Facts
        facts={[
          { label: formatDateRange(section.cycle.startDate, section.cycle.endDate) },
          section.participantCount > 0
            ? { label: `${section.approvedCount} of ${plural(section.participantCount, "plan")} approved` }
            : null,
          section.exceptionCount > 0 ? { label: `${plural(section.exceptionCount, "exception")} at closure` } : null,
          section.myPlanProgress !== null ? { label: `Your plan closed at ${Math.round(section.myPlanProgress)}%` } : null,
        ]}
      />
    </OverviewSection>
  );
}

/** Nothing has run yet: administration starts the first Cycle; everyone else is told plainly. */
export function NoCycleSection({ section }: { section: Section<"noCycle"> }) {
  const create = section.create;
  return (
    <OverviewSection
      label="Performance cycle"
      attention={Boolean(create)}
      action={create ? <SectionAction href={overviewHref(create)} primary>Create cycle</SectionAction> : undefined}
    >
      <Headline attention={Boolean(create)} muted={!create}>
        {create ? "No performance cycle yet" : "There is no active performance cycle"}
      </Headline>
    </OverviewSection>
  );
}

/** For someone with no section of their own in a running Cycle: its state, and nothing invented. */
export function CycleStatusSection({ section }: { section: Section<"cycleStatus"> }) {
  const cycle = section.cycle;
  return (
    <OverviewSection label="Performance cycle">
      <Headline>{cycle.name} is running</Headline>
      <Facts
        facts={[
          section.phase === "Planning" ? { label: `Planning open until ${formatDate(cycle.planningDeadline)}` } : null,
          { label: `Ends ${formatDate(cycle.endDate)}` },
        ]}
      />
    </OverviewSection>
  );
}
