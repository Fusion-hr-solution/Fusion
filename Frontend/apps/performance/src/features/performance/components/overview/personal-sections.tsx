"use client";

import type { CycleSummaryDto } from "@repo/api";
import { ChevronRight } from "@/lib/icons";
import { useMyPlan, useTeamObjectiveWorkspace, useTeamRoster } from "../../api/use-performance";
import { useWorkforceMe } from "../../api/use-workforce-me";
import { formatDate } from "../../lib";
import { useObjectiveRecord } from "../objective-record/use-objective-record";
import { cyclePhase, localToday, planExecution, teamAttention } from "./overview-model";
import { Facts, Headline, OverviewSection, ProgressLine, SectionAction, SectionSkeleton } from "./overview-primitives";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Where one's own plan stands, and the one thing to do next with it. */
export function MyPlanSection({ cycle }: { cycle: CycleSummaryDto }) {
  const my = useMyPlan(cycle.id);
  if (my.isLoading || !my.data) {
    return (
      <OverviewSection label="My plan">
        <SectionSkeleton />
      </OverviewSection>
    );
  }
  if (!my.data.participatesInCycle) {
    return (
      <OverviewSection label="My plan">
        <p className="text-sm text-muted-foreground">You are not part of this cycle.</p>
      </OverviewSection>
    );
  }

  const plan = my.data.plan;
  const reviewer = plan?.responsibleManager?.name ?? my.data.preview?.reviewer?.name ?? null;
  const latest = plan?.history.at(-1);
  const { planningOpen } = cyclePhase(cycle, localToday());
  // The deadline matters while a plan is still being written: open, or already past and owed.
  const deadline = planningOpen
    ? { label: `Planning open until ${formatDate(cycle.planningDeadline)}` }
    : { label: `Planning closed ${formatDate(cycle.planningDeadline)}`, tone: "critical" as const };

  if (!plan || (plan.state === "Draft" && plan.objectives.length === 0 && latest?.kind !== "Returned")) {
    return (
      <OverviewSection label="My plan" attention action={<SectionAction href="/plan" primary>Start planning</SectionAction>}>
        <Headline attention>Start your plan</Headline>
        <Facts facts={[deadline, reviewer ? { label: `Reviewer · ${reviewer}` } : null]} />
      </OverviewSection>
    );
  }

  if (plan.state === "Draft" && latest?.kind === "Returned") {
    return (
      <OverviewSection label="My plan" attention action={<SectionAction href="/plan" primary>Revise plan</SectionAction>}>
        <Headline attention>Your plan was returned for changes</Headline>
        {latest.feedback ? (
          <blockquote className="mt-2 border-l-2 border-primary/50 pl-3 text-sm text-muted-foreground">
            <span className="text-foreground">{latest.actorName ?? reviewer ?? "Your reviewer"}:</span> “{latest.feedback}”
          </blockquote>
        ) : null}
      </OverviewSection>
    );
  }

  if (plan.state === "Draft") {
    return (
      <OverviewSection label="My plan" action={<SectionAction href="/plan">Continue</SectionAction>}>
        <Headline>Your plan is in progress</Headline>
        <Facts
          facts={[
            { label: plural(plan.objectives.length, "objective") },
            { label: `${plan.readiness.weightTotal}% of 100% weighted` },
            deadline,
          ]}
        />
      </OverviewSection>
    );
  }

  if (plan.state === "Submitted") {
    return (
      <OverviewSection label="My plan" action={<SectionAction href="/plan">View plan</SectionAction>}>
        <Headline>Awaiting {reviewer ? `${reviewer}’s` : "your reviewer’s"} decision</Headline>
        <Facts facts={[plan.submittedAt ? { label: `Submitted ${formatDate(plan.submittedAt.slice(0, 10))}` } : null]} />
      </OverviewSection>
    );
  }

  const execution = planExecution(plan, localToday());
  const needsUpdate = execution.overdueMilestones > 0 || execution.reporting === 0;
  return (
    <OverviewSection
      label="My plan"
      attention={needsUpdate}
      action={
        <SectionAction href="/plan" primary={needsUpdate}>
          {needsUpdate ? "Update progress" : "Open plan"}
        </SectionAction>
      }
    >
      <div className="flex max-w-xl items-baseline gap-4">
        <span className="type-metric text-foreground">{execution.reporting > 0 ? `${Math.round(plan.planProgress)}%` : "—"}</span>
        <ProgressLine value={plan.planProgress} has={execution.reporting > 0} className="flex-1 [&>span:last-child]:hidden" />
      </div>
      <Facts
        facts={[
          { label: `${execution.reporting} of ${plural(execution.objectiveCount, "objective")} reporting`, tone: execution.reporting === 0 ? "attention" : "default" },
          execution.overdueMilestones > 0 ? { label: `${plural(execution.overdueMilestones, "milestone")} overdue`, tone: "critical" } : null,
        ]}
      />
    </OverviewSection>
  );
}

/** What the people one leads need from them — the roster's situation, never the roster itself. */
export function TeamAttentionSection({ cycle }: { cycle: CycleSummaryDto }) {
  const roster = useTeamRoster(cycle.id);
  if (roster.isLoading || !roster.data) {
    return (
      <OverviewSection label="Your team">
        {roster.error ? <Headline muted>Your team could not be loaded</Headline> : <SectionSkeleton />}
      </OverviewSection>
    );
  }

  const team = teamAttention(roster.data);
  const deciding = team.awaitingDecision > 0;
  if (team.people === 0) {
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
        <SectionAction href="/team" primary={deciding}>
          {deciding ? `Review ${plural(team.awaitingDecision, "plan")}` : "Open Team Performance"}
        </SectionAction>
      }
    >
      <Headline attention={deciding}>
        {deciding
          ? `${plural(team.awaitingDecision, "plan")} ${team.awaitingDecision === 1 ? "awaits" : "await"} your decision`
          : `${plural(team.people, "person", "people")} · ${team.approved === 0 ? "no approved plans yet" : `${team.approved} approved ${team.approved === 1 ? "plan" : "plans"}`}`}
      </Headline>
      <Facts
        facts={[
          deciding ? { label: `${plural(team.people, "person", "people")}` } : null,
          team.notStarted > 0 ? { label: `${team.notStarted} not started`, tone: "attention" } : null,
          team.returned > 0 ? { label: `${team.returned} returned for changes` } : null,
          team.approvedNotReporting > 0 ? { label: `${team.approvedNotReporting} approved, not reporting`, tone: "attention" } : null,
          team.withOverdue > 0 ? { label: `${team.withOverdue} with overdue milestones`, tone: "critical" } : null,
        ]}
      />
    </OverviewSection>
  );
}

/** The objective the leader's own team owns: its progress, opening in the objective record. */
export function TeamObjectiveSection({ cycle }: { cycle: CycleSummaryDto }) {
  const me = useWorkforceMe(true);
  const unit = me.data?.employee?.orgUnit ?? null;
  const workspace = useTeamObjectiveWorkspace(cycle.id, unit?.orgUnitId, unit !== null);
  const record = useObjectiveRecord();

  if (me.isLoading || (unit && workspace.isLoading)) {
    return (
      <OverviewSection label="Team objective">
        <SectionSkeleton />
      </OverviewSection>
    );
  }
  // No placement, or the team's workspace is not available for this cycle: nothing truthful to say here.
  if (!unit || workspace.error || !workspace.data) return null;

  const objectives = workspace.data.objectives;
  return (
    <OverviewSection
      label={objectives.length > 1 ? "Team objectives" : "Team objective"}
      action={objectives.length === 0 ? <SectionAction href="/team">Set a team objective</SectionAction> : undefined}
    >
      {objectives.length === 0 ? (
        <Headline muted>No objective for {workspace.data.orgUnitName} yet</Headline>
      ) : (
        <ul className="-mx-3">
          {objectives.slice(0, 3).map(({ node }) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => record.open({ cycleId: cycle.id, objectiveId: node.id })}
                className="group flex w-full items-center gap-4 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="type-panel-title block truncate text-foreground">{node.title}</span>
                  {node.state === "Draft" ? <span className="type-meta text-muted-foreground">Draft</span> : null}
                </span>
                {node.state === "Published" ? (
                  <ProgressLine value={node.derivedProgress} has={node.hasProgress} className="w-48 shrink-0" />
                ) : null}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </OverviewSection>
  );
}
