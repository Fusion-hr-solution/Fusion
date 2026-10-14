"use client";

import type { GoalNodeDto, OverviewSectionDto } from "@repo/api";
import { ChevronRight } from "@/lib/icons";
import { formatDate } from "../../lib";
import { objectiveHref } from "@/lib/performance-routes";
import { useObjectiveRecord } from "../objective-record/use-objective-record";
import { overviewHref, plural } from "./overview-model";
import { Facts, Headline, OverviewSection, ProgressLine, SectionAction } from "./overview-primitives";

type Section<K extends OverviewSectionDto["kind"]> = Extract<OverviewSectionDto, { kind: K }>;

/** Where one's own plan stands, and the one thing to do next with it. */
export function MyPlanSection({ section }: { section: Section<"myPlan"> }) {
  const href = overviewHref(section.destination);
  const reviewer = section.reviewerName;
  // The deadline matters while a plan is still being written: open, or already past and owed.
  const deadline = section.planningOpen
    ? { label: `Planning open until ${formatDate(section.planningDeadline)}` }
    : { label: `Planning closed ${formatDate(section.planningDeadline)}`, tone: "critical" as const };

  switch (section.standing) {
    case "NotStarted":
      return (
        <OverviewSection label="My plan" attention action={<SectionAction href={href} primary>Start planning</SectionAction>}>
          <Headline attention>Start your plan</Headline>
          <Facts facts={[deadline, reviewer ? { label: `Reviewer · ${reviewer}` } : null]} />
        </OverviewSection>
      );
    case "ReturnedForChanges":
      return (
        <OverviewSection label="My plan" attention action={<SectionAction href={href} primary>Revise plan</SectionAction>}>
          <Headline attention>Your plan was returned for changes</Headline>
          {section.returnFeedback ? (
            <blockquote className="mt-2 border-l-2 border-primary/50 pl-3 text-sm text-muted-foreground">
              <span className="text-foreground">{section.returnedBy ?? "Your reviewer"}:</span> “{section.returnFeedback}”
            </blockquote>
          ) : null}
        </OverviewSection>
      );
    case "Draft":
      return (
        <OverviewSection label="My plan" action={<SectionAction href={href}>Continue</SectionAction>}>
          <Headline>Your plan is in progress</Headline>
          <Facts
            facts={[
              { label: plural(section.objectiveCount, "objective") },
              { label: `${Math.round(section.weightTotal)}% of 100% weighted` },
              deadline,
            ]}
          />
        </OverviewSection>
      );
    case "Submitted":
      return (
        <OverviewSection label="My plan" action={<SectionAction href={href}>View plan</SectionAction>}>
          <Headline>Awaiting {reviewer ? `${reviewer}’s` : "your reviewer’s"} decision</Headline>
          <Facts facts={[section.submittedAt ? { label: `Submitted ${formatDate(section.submittedAt.slice(0, 10))}` } : null]} />
        </OverviewSection>
      );
    case "Approved": {
      const e = section.execution;
      if (!e) return null;
      const needsUpdate = e.overdueObjectiveCount > 0 || e.withoutRecentUpdateCount > 0 || e.reportingCount === 0;
      return (
        <OverviewSection
          label="My plan"
          attention={needsUpdate}
          action={
            <SectionAction href={href} primary={needsUpdate}>
              {needsUpdate ? "Update progress" : "Open plan"}
            </SectionAction>
          }
        >
          <div className="flex max-w-xl items-baseline gap-4">
            <span className="type-metric text-foreground">{e.reportingCount > 0 ? `${Math.round(e.planProgress)}%` : "—"}</span>
            <ProgressLine value={e.planProgress} has={e.reportingCount > 0} className="flex-1 [&>span:last-child]:hidden" />
          </div>
          <Facts
            facts={[
              {
                label: `${e.reportingCount} of ${plural(e.objectiveCount, "objective")} reporting`,
                tone: e.reportingCount === 0 ? "attention" : "default",
              },
              e.overdueObjectiveCount > 0 ? { label: `${plural(e.overdueObjectiveCount, "objective")} overdue`, tone: "critical" } : null,
              e.withoutRecentUpdateCount > 0
                ? { label: `${plural(e.withoutRecentUpdateCount, "objective")} without an update in 30 days`, tone: "attention" }
                : null,
            ]}
          />
        </OverviewSection>
      );
    }
  }
}

/** What the people one is responsible for need — their situation in counts, never the roster itself. */
export function TeamSection({ planning, execution }: { planning: Section<"teamPlanning">; execution?: Section<"teamExecution"> }) {
  const deciding = planning.awaitingDecision > 0;
  if (planning.people === 0) {
    return (
      <OverviewSection label="Your team">
        <Headline muted>No one reports to you in this cycle</Headline>
      </OverviewSection>
    );
  }
  return (
    <OverviewSection
      label="Your team"
      attention={deciding}
      action={
        <SectionAction href={overviewHref(planning.destination)} primary={deciding}>
          {deciding ? `Review ${plural(planning.awaitingDecision, "plan")}` : "Open Team Performance"}
        </SectionAction>
      }
    >
      <Headline attention={deciding}>
        {deciding
          ? `${plural(planning.awaitingDecision, "plan")} ${planning.awaitingDecision === 1 ? "awaits" : "await"} your decision`
          : `${plural(planning.people, "person", "people")} · ${planning.approved === 0 ? "no approved plans yet" : `${planning.approved} approved ${planning.approved === 1 ? "plan" : "plans"}`}`}
      </Headline>
      <Facts
        facts={[
          deciding ? { label: plural(planning.people, "person", "people") } : null,
          planning.notStarted > 0 ? { label: `${planning.notStarted} not started`, tone: "attention" } : null,
          planning.returned > 0 ? { label: `${planning.returned} returned for changes` } : null,
          execution && execution.approved - execution.approvedReporting > 0
            ? { label: `${execution.approved - execution.approvedReporting} approved, not reporting`, tone: "attention" }
            : null,
          execution && execution.peopleWithOverdue > 0
            ? { label: `${plural(execution.peopleWithOverdue, "person", "people")} with overdue objectives`, tone: "critical" }
            : null,
          execution && execution.peopleWithoutRecentUpdate > 0
            ? { label: `${execution.peopleWithoutRecentUpdate} without a recent update`, tone: "attention" }
            : null,
        ]}
      />
    </OverviewSection>
  );
}

/** The objectives one's own team owns, each opening in its record. */
export function TeamDirectionSection({ section, cycleId }: { section: Section<"teamDirection">; cycleId: string }) {
  return (
    <OverviewSection
      label={section.total > 1 ? "Team objectives" : "Team objective"}
      action={section.total === 0 ? <SectionAction href={overviewHref(section.destination)}>Set a team objective</SectionAction> : undefined}
    >
      {section.total === 0 ? (
        <Headline muted>No team objective yet</Headline>
      ) : (
        <ObjectiveList objectives={section.objectives} cycleId={cycleId} showDraft />
      )}
    </OverviewSection>
  );
}

/** A short list of objectives, each opening in the objective record. */
export function ObjectiveList({
  objectives,
  cycleId,
  showDraft,
  describe,
}: {
  objectives: GoalNodeDto[];
  cycleId: string;
  showDraft?: boolean;
  describe?: (node: GoalNodeDto) => string;
}) {
  const record = useObjectiveRecord();
  return (
    <ul className="-mx-3">
      {objectives.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => record.open({ cycleId, objectiveId: node.id })}
            className="group flex w-full items-center gap-4 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="type-panel-title block truncate text-foreground">{node.title}</span>
              {showDraft && node.state === "Draft" ? (
                <span className="type-meta text-muted-foreground">Draft</span>
              ) : describe ? (
                <span className="type-meta text-muted-foreground">{describe(node)}</span>
              ) : null}
            </span>
            {node.state === "Published" ? (
              <ProgressLine value={node.derivedProgress} has={node.hasProgress} className="hidden w-48 shrink-0 sm:flex" />
            ) : null}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Asks for a progress update on one's own plan: who asked, about what, resuming in record-progress. */
export function MyRequestsSection({ section }: { section: Section<"myRequests"> }) {
  const first = section.requests[0]!;
  const resume = (destination: (typeof first)["destination"]) => destination.workspace === "Objective" && destination.cycleId && destination.objectiveId
    ? objectiveHref({ cycleId: destination.cycleId, objectiveId: destination.objectiveId }, "record")
    : overviewHref(destination);
  return (
    <OverviewSection label="Update requests" attention action={<SectionAction href={resume(first.destination)} primary>Record progress</SectionAction>}>
      <Headline attention>
        {section.requests.length === 1
          ? `${first.requestedByName} asked for an update${first.objectiveTitle ? ` on ${first.objectiveTitle}` : " on your plan"}`
          : `${plural(section.requests.length, "update request")} from your reviewer`}
      </Headline>
      <Facts facts={section.requests.length === 1
        ? [{ label: `Asked ${formatDate(first.requestedAt)}` }, first.note ? { label: first.note } : null]
        : section.requests.map((request) => ({ label: request.objectiveTitle ?? "Your plan" }))} />
    </OverviewSection>
  );
}
