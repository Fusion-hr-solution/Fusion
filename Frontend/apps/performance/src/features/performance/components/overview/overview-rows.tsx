"use client";

import type { GoalNodeDto, OverviewRow as Row, UnitShareDto } from "@repo/api";
import Link from "next/link";
import { cn } from "@repo/ds/lib/utils";
import { PersonInitials } from "@repo/performance-ui";
import { Check, ChevronRight } from "@/lib/icons";
import { useOneOnOnes } from "../../api/use-conversations";
import { calibrationHref, roundHref, withCycle } from "@/lib/performance-routes";
import { useObjectiveRecord } from "../objective-record/use-objective-record";
import { LaunchReadiness } from "../launch-readiness";
import { deriveSetupState, earliestIncompleteStep, setupStepHref } from "../cycle-setup/setup-readiness";
import { PLAN_WORD, REVIEW_CHIP, ago, appHref, day, daysFrom, firstName, plural } from "./overview-model";
import {
  Chips,
  Facts,
  Headline,
  MiniItem,
  MiniList,
  N,
  OverviewRow,
  ProgressLine,
  RowAction,
  SegmentBar,
  StepsStrip,
  type Tone,
} from "./overview-primitives";

const insights = (cycleId: string, unitId?: string | null) =>
  withCycle(`/cycle?view=insights${unitId ? `&unit=${unitId}` : ""}`, cycleId);

function UnitsBehind({ units, cycleId, describe }: { units: UnitShareDto[]; cycleId: string; describe: (u: UnitShareDto) => string }) {
  if (units.length === 0) return null;
  return (
    <>
      <p className="mt-5 type-meta text-muted-foreground">Furthest behind</p>
      <MiniList label="Units furthest behind">
        {units.map((u) => (
          <MiniItem
            key={u.unitId ?? u.name}
            href={insights(cycleId, u.unitId)}
            title={u.name}
            sub={describe(u)}
            trailing={<ProgressLine value={u.total ? (u.count / u.total) * 100 : 0} has className="hidden w-44 sm:flex" />}
          />
        ))}
      </MiniList>
    </>
  );
}

// ── Administration ────────────────────────────────────────────────────────────────────────────────────────────────

export function NextCycleRow({ row }: { row: Row<"nextCycle"> }) {
  if (!row.cycleId || !row.setup) {
    return (
      <OverviewRow label="Next cycle">
        <Headline tone="attention" action={<RowAction href="/cycle/setup/details" primary>Create the next cycle</RowAction>}>
          No next cycle yet
        </Headline>
      </OverviewRow>
    );
  }
  const state = deriveSetupState(row.setup);
  const next = setupStepHref(earliestIncompleteStep(state), row.cycleId);
  // Ready to launch: the decision is activation, and the checklist has nothing left to say.
  const ready = state.readyToLaunch;
  const startPassed = row.plannedStart !== null && daysFrom(row.plannedStart) <= 0;
  return (
    <OverviewRow label="Next cycle" sub={`${row.name} · Draft`} link={{ href: withCycle("/cycle/setup", row.cycleId), label: "Cycle" }}>
      <Headline tone="attention" action={<RowAction href={next} primary>{ready ? "Review and activate" : "Continue setup"}</RowAction>}>
        {ready ? `${row.name} is ready to activate` : `Set up ${row.name}`}
      </Headline>
      {row.plannedStart ? (
        <Facts facts={[startPassed
          ? { label: `Planned start ${day(row.plannedStart)} has passed`, tone: "attention" }
          : { label: `Planned start ${day(row.plannedStart)}` }]} />
      ) : null}
      {ready ? null : (
        <div className="mt-4 max-w-3xl">
          <LaunchReadiness readiness={row.setup.launchReadiness} />
        </div>
      )}
    </OverviewRow>
  );
}

export function CycleRow({ row }: { row: Row<"cycle"> }) {
  const link = { href: insights(row.cycleId), label: "Insights" };
  if (row.setup) {
    const next = setupStepHref(earliestIncompleteStep(deriveSetupState(row.setup)));
    return (
      <OverviewRow label={`${row.cycleName} setup`} sub="Draft" link={{ href: withCycle("/cycle/setup", row.cycleId), label: "Cycle" }}>
        <Headline tone="attention" action={<RowAction href={next} primary>Continue setup</RowAction>}>{row.cycleName} is being set up</Headline>
        <div className="mt-4 max-w-3xl">
          <LaunchReadiness readiness={row.setup.launchReadiness} />
        </div>
        <Facts facts={[{ label: `Only administrators see ${row.cycleName} until you activate it` }]} />
      </OverviewRow>
    );
  }

  if (row.review) {
    const r = row.review;
    const calibrationOpen = r.calibrationEnabled && r.calibrationState === "Open";
    const steps = [
      { label: "Self-assessments", detail: `${r.selfSubmitted} of ${r.selfTotal}`, state: r.selfSubmitted >= r.selfTotal ? "done" : "current" },
      {
        label: "Manager reviews",
        detail: `${r.managerSubmitted} of ${r.managerTotal}${r.managerLate ? ` · ${r.managerLate} late` : ""}`,
        state: r.managerSubmitted >= r.managerTotal ? "done" : r.selfSubmitted >= r.selfTotal ? "current" : "upcoming",
      },
      ...(r.calibrationEnabled
        ? [{ label: "Calibration", detail: r.calibrationState ? `${r.calibrationDiscussed} discussed` : "Not open", state: calibrationOpen ? "current" : r.calibrationState === "Finalized" ? "done" : "upcoming" }]
        : []),
      { label: "Release", detail: "By you", state: r.readyToFinalize > 0 && r.readyToFinalize === r.subjects ? "current" : "upcoming" },
    ] as { label: string; detail: string; state: "done" | "current" | "upcoming" }[];
    return (
      <OverviewRow label={r.roundName} sub={plural(r.subjects, "person", "people")} link={{ href: withCycle(roundHref(r.roundId), row.cycleId), label: "Open the round" }}>
        <Headline
          tone="attention"
          action={
            calibrationOpen ? (
              <RowAction href={calibrationHref(r.roundId)} primary>Open calibration</RowAction>
            ) : (
              <RowAction href={roundHref(r.roundId)}>Open the round</RowAction>
            )
          }
        >
          {calibrationOpen
            ? `Calibration is open: ${r.calibrationDiscussed} of ${r.calibrationSubjects} discussed`
            : `Manager reviews: ${r.managerSubmitted} of ${r.managerTotal} in`}
        </Headline>
        {calibrationOpen && r.managerSubmitted < r.managerTotal ? (
          <p className="mt-1 type-body-secondary text-muted-foreground">Finalize when the last manager reviews are in.</p>
        ) : null}
        <StepsStrip steps={steps} />
        {r.lateManagers.length > 0 ? (
          <>
            <p className="mt-5 type-meta text-muted-foreground">Most late manager reviews</p>
            <MiniList label="Most late manager reviews">
              {r.lateManagers.map((m) => (
                <MiniItem
                  key={m.employeeId}
                  href={insights(row.cycleId)}
                  title={m.name}
                  sub={`${m.unitName ? `${m.unitName} · ` : ""}${m.submitted} of ${m.total} in`}
                  trailing={<span className="type-meta text-warning">{m.late} late</span>}
                />
              ))}
              {r.otherLateManagers > 0 ? (
                <MiniItem href={insights(row.cycleId)} title={`${plural(r.otherLateManagers, "other manager")}`} sub={`${r.otherLate} late in all`} />
              ) : null}
            </MiniList>
          </>
        ) : null}
      </OverviewRow>
    );
  }

  if (row.closed) {
    const c = row.closed;
    return (
      <OverviewRow label={row.cycleName} sub="Closed" link={link}>
        <Headline action={<RowAction href={withCycle("/cycle", row.cycleId)}>Closure record</RowAction>}>
          <span className="type-metric tabular-nums">{c.acknowledged}</span>{" "}
          <span className="text-muted-foreground">of {plural(c.released, "result")} acknowledged</span>
        </Headline>
        <Facts
          facts={[
            { label: <><N>{c.released}</N> results released{c.releasedAt ? ` ${day(c.releasedAt)}` : ""}</> },
            { label: <><N>{c.calibrationChanged}</N> ratings changed in calibration</> },
            { label: <><N>{c.openGrowthGoals}</N> open growth goals</> },
          ]}
        />
      </OverviewRow>
    );
  }

  if (row.execution) {
    const e = row.execution;
    return (
      <OverviewRow label={row.cycleName} sub={`${row.approvedPlans} of ${plural(row.participants, "plan")} approved`} link={link}>
        <Headline action={<RowAction href={withCycle("/cycle", row.cycleId)}>Open the cycle</RowAction>}>
          <span className="type-metric tabular-nums">{e.updatedIn30Days}</span>{" "}
          <span className="text-muted-foreground">of {e.approvedPlans} approved plans updated in the last 30 days</span>
        </Headline>
        <p className="mt-4 type-meta text-muted-foreground">Objective status, as their owners set it · {plural(e.objectives, "objective")}</p>
        <SegmentBar
          label="Objective status"
          segments={[
            { count: e.status.onTrack, className: "bg-success" },
            { count: e.status.atRisk, className: "bg-warning" },
            { count: e.status.offTrack, className: "bg-destructive" },
            { count: e.status.noStatus, className: "bg-inlay ring-1 ring-inset ring-border" },
          ]}
        />
        <Facts
          facts={[
            { label: <><N>{e.status.onTrack}</N> on track</>, tone: "ok" },
            { label: <><N>{e.status.atRisk}</N> at risk</>, tone: "risk" },
            { label: <><N>{e.status.offTrack}</N> off track</>, tone: "off" },
            { label: <><N>{e.status.noStatus}</N> no status yet</> },
            e.neverApproved > 0 && { label: <><N>{e.neverApproved}</N> plans never approved</> },
          ]}
        />
        <UnitsBehind units={e.furthestBehind} cycleId={row.cycleId} describe={(u) => `${u.count} of ${u.total} updated · ${u.missing} not`} />
      </OverviewRow>
    );
  }

  const p = row.planning!;
  return (
    <OverviewRow label={row.cycleName} sub={plural(row.participants, "person", "people")} link={link}>
      <Headline action={<RowAction href={withCycle("/cycle", row.cycleId)}>Open the cycle</RowAction>}>
        <span className="type-metric tabular-nums">{p.plans.approved}</span>{" "}
        <span className="text-muted-foreground">of {plural(row.participants, "plan")} approved</span>
      </Headline>
      <SegmentBar
        label="Plan states"
        segments={[
          { count: p.plans.approved, className: "bg-success" },
          { count: p.plans.submitted, className: "bg-primary" },
          { count: p.plans.drafting, className: "bg-muted-foreground/60" },
          { count: p.plans.notStarted, className: "bg-inlay ring-1 ring-inset ring-border" },
        ]}
      />
      <Facts
        facts={[
          { label: <><N>{p.plans.approved}</N> approved</>, tone: "ok" },
          { label: <><N>{p.plans.submitted}</N> submitted</>, tone: "attention" },
          { label: <><N>{p.plans.drafting}</N> drafting</> },
          { label: <><N>{p.plans.notStarted}</N> not started</> },
        ]}
      />
      <UnitsBehind units={p.furthestBehind} cycleId={row.cycleId} describe={(u) => `${u.count} of ${u.total} approved · ${u.missing} not started`} />
    </OverviewRow>
  );
}

// ── Responsibility ────────────────────────────────────────────────────────────────────────────────────────────────

export function TeamRow({ row, cycleId, quietAfterReviews }: { row: Row<"team">; cycleId: string; quietAfterReviews?: boolean }) {
  const link = { href: withCycle("/team", cycleId), label: "My Team" };
  const sub = [plural(row.people, "person", "people"), row.objectives ? plural(row.objectives, "objective") : null].filter(Boolean).join(" · ");
  const recency = [
    row.approvedPlans > 0 && { label: <><N>{row.updatedIn30Days}</N> of {row.approvedPlans} updated in the last 30 days</> },
    row.withoutRecentUpdateTotal > 0 && {
      label: <>No update in 30 days: <N>{row.withoutRecentUpdate.join(", ")}{row.withoutRecentUpdateTotal > row.withoutRecentUpdate.length ? ` and ${row.withoutRecentUpdateTotal - row.withoutRecentUpdate.length} more` : ""}</N></>,
      tone: "attention" as Tone,
    },
    row.openRequests > 0 && { label: <><N>{row.openRequests}</N> {row.openRequests === 1 ? "update request" : "update requests"} open</> },
  ];

  if (row.results) {
    const r = row.results;
    return (
      <OverviewRow label="Your team" sub={sub} link={link}>
        <Headline tone="ok" action={<RowAction href={withCycle("/team", cycleId)}>Open My Team</RowAction>}>
          Results are out for your {plural(r.released, "person", "people")}
        </Headline>
        <p className="mt-1 type-body-secondary text-muted-foreground">
          {r.acknowledged} acknowledged
          {r.notAcknowledged.length > 0 ? ` · not yet: ${r.notAcknowledged.join(", ")}` : ""}
        </p>
        <Facts
          facts={[
            { label: <><N>{r.calibrationChanged}</N> {r.calibrationChanged === 1 ? "rating changed" : "ratings changed"} in calibration</> },
            { label: <><N>{r.withOpenGrowthGoals}</N> of {r.released} have open growth goals to carry</> },
          ]}
        />
      </OverviewRow>
    );
  }

  if (row.awaitingDecision > 0 && row.firstAwaitingHref) {
    return (
      <OverviewRow label="Your team" sub={sub} link={link}>
        <Headline tone="attention" action={<RowAction href={row.firstAwaitingHref} primary>Review {firstName(row.firstAwaitingName)}&apos;s plan</RowAction>}>
          {row.awaitingDecision === 1 ? "1 plan waits for your decision" : `${row.awaitingDecision} plans wait for your decision`}
        </Headline>
        <Chips chips={row.chips} word={(chip) => (chip.state === "Submitted" && chip.since ? `Submitted ${ago(chip.since)}` : PLAN_WORD[chip.state] ?? chip.state)} />
      </OverviewRow>
    );
  }

  if (row.flaggedTotal > 0) {
    const only = row.flagged[0]!;
    return (
      <OverviewRow label="Your team" sub={sub} link={link}>
        <Headline tone={only.status === "OffTrack" ? "off" : "attention"} action={<RowAction href={withCycle("/team", cycleId)} primary>Open My Team</RowAction>}>
          {row.flaggedTotal === 1
            ? `${only.personName}'s objective is ${only.status === "OffTrack" ? "off track" : "at risk"}`
            : `${row.flaggedTotal} objectives are off track or at risk`}
        </Headline>
        <MiniList label="Objectives off track or at risk">
          {row.flagged.map((f) => (
            <MiniItem
              key={f.objectiveId}
              href={f.href}
              title={<>{f.personName} · {f.title}</>}
              sub={<>{f.reason ? `"${f.reason}"` : "No reason given"}{f.since ? ` · since ${day(f.since)}` : ""}</>}
              trailing={
                <span className="hidden items-center gap-4 sm:flex">
                  <span className={cn("inline-flex items-center gap-1.5 type-meta", f.status === "OffTrack" ? "text-destructive" : "text-warning")}>
                    <span className={cn("size-2 rounded-full", f.status === "OffTrack" ? "bg-destructive" : "bg-warning")} aria-hidden />
                    {f.status === "OffTrack" ? "Off track" : "At risk"}
                  </span>
                  <ProgressLine value={f.progress} has className="w-36" />
                </span>
              }
            />
          ))}
        </MiniList>
        <Facts facts={recency} />
      </OverviewRow>
    );
  }

  if (quietAfterReviews) {
    return (
      <OverviewRow label="Your team" link={link}>
        <Headline>Objectives close {day(row.cycleEnd)}</Headline>
        <Facts facts={recency} />
      </OverviewRow>
    );
  }

  const planning = row.plans.approved < row.people;
  return (
    <OverviewRow label="Your team" sub={sub} link={link}>
      <Headline tone={planning ? "quiet" : "ok"}>
        {planning ? `${row.plans.approved} of ${plural(row.people, "plan")} approved` : "Nothing on your team needs you"}
      </Headline>
      {planning ? (
        <Chips chips={row.chips} word={(chip) => PLAN_WORD[chip.state] ?? chip.state} />
      ) : (
        <Facts facts={recency} />
      )}
    </OverviewRow>
  );
}

export function ReviewsYouWriteRow({ row }: { row: Row<"reviewsYouWrite"> }) {
  const link = { href: "/reviews", label: "Reviews" };
  const sub = row.dueDate ? `Due ${day(row.dueDate)}` : row.roundName;
  if (row.inCalibration) {
    return (
      <OverviewRow label="Reviews you write" link={link}>
        <Headline tone="ok">All {row.total} submitted</Headline>
        <p className="mt-1 type-body-secondary text-muted-foreground">In calibration</p>
      </OverviewRow>
    );
  }
  return (
    <OverviewRow label="Reviews you write" sub={sub} link={link}>
      <Headline
        tone={row.ready > 0 ? "attention" : row.total > 0 && row.submitted === row.total ? "ok" : "quiet"}
        action={row.firstReadyHref ? <RowAction href={row.firstReadyHref} primary>Review {firstName(row.firstReadyName)}</RowAction> : undefined}
      >
        {row.ready > 0
          ? row.ready === 1 ? "1 review is ready for you" : `${row.ready} reviews are ready for you`
          : row.total > 0 && row.submitted === row.total ? `All ${row.total} submitted` : `${row.submitted} of ${row.total} submitted`}
      </Headline>
      <Chips chips={row.chips} word={(chip) => REVIEW_CHIP[chip.state] ?? chip.state} />
      <Facts
        facts={[
          row.peerListsToApprove > 0 && {
            label: <><N>{row.peerListsToApprove}</N> {row.peerListsToApprove === 1 ? "peer list" : "peer lists"} to approve{row.peerListsDue ? `, by ${day(row.peerListsDue)}` : ""}</>,
            tone: "attention" as Tone,
          },
          // The count is the headline unless reviews are waiting.
          row.ready > 0 && { label: <><N>{row.submitted}</N> of {row.total} submitted</> },
        ]}
      />
    </OverviewRow>
  );
}

// ── One's own ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function OwnReviewRow({ row, own }: { row: Row<"ownReview">; own?: boolean }) {
  const label = own ? "Your own review" : row.result ? "Your result" : "Your review";
  const link = { href: "/reviews", label: "Reviews" };
  if (row.result) {
    const r = row.result;
    return (
      <OverviewRow label={label} sub={row.roundName} link={link}>
        <Headline
          action={
            r.acknowledgedAt ? <RowAction href={row.href}>Read your review</RowAction> : <RowAction href={row.href} primary>Read and acknowledge</RowAction>
          }
        >
          <span className="inline-flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-detail bg-primary/15 type-panel-title text-primary ring-1 ring-inset ring-primary/50">{r.level}</span>
            {r.label}
          </span>
        </Headline>
        <p className="mt-2 type-body-secondary text-muted-foreground">
          Released {day(r.releasedAt)} · {r.acknowledgedAt ? `you acknowledged it on ${day(r.acknowledgedAt)}` : "not acknowledged yet"}
        </p>
      </OverviewRow>
    );
  }
  if (row.state === "SelfAssessment" && row.steps) {
    return (
      <OverviewRow label={label} sub={row.roundName} link={own ? undefined : link}>
        <Headline tone="attention" action={<RowAction href={row.href} primary={!own}>Continue writing</RowAction>}>
          {row.dueDate ? `Your self-assessment is due ${day(row.dueDate)}` : "Write your self-assessment"}
        </Headline>
        <p className="mt-1 type-body-secondary text-muted-foreground">
          {[row.draftSavedAt ? `Draft saved ${ago(row.draftSavedAt)}` : null,
            row.peersAsked > 0 ? `${row.peersAnswered} of ${row.peersAsked} colleagues have shared their input` : null].filter(Boolean).join(" · ") || "Not started"}
        </p>
        <StepsStrip steps={row.steps} />
      </OverviewRow>
    );
  }
  return (
    <OverviewRow label={label} sub={row.roundName} link={link}>
      <Headline tone="attention">With {row.reviewerName}</Headline>
      <p className="mt-1 type-body-secondary text-muted-foreground">
        {row.selfSubmittedAt ? `Your self-assessment went in on ${day(row.selfSubmittedAt)}` : "Your review is with your reviewer"}
        {row.dueDate ? ` · their review is due ${day(row.dueDate)}` : ""}
      </p>
    </OverviewRow>
  );
}

export function InputOwedRow({ row }: { row: Row<"inputOwed"> }) {
  const first = row.requests[0]!;
  return (
    <OverviewRow label="Input you owe">
      <Headline tone="attention" action={<RowAction href={first.href}>Answer</RowAction>}>
        {first.subjectName} asked for your input
      </Headline>
      <p className="mt-1 type-body-secondary text-muted-foreground">
        {[first.questions ? plural(first.questions, "question") : null, first.dueDate ? `due ${day(first.dueDate)}` : null,
          `only ${firstName(first.subjectName)}'s manager and HR read it`].filter(Boolean).join(" · ")}
      </p>
      {row.requests.length > 1 ? <Facts facts={[{ label: `${plural(row.requests.length - 1, "more request")} in Reviews` }]} /> : null}
    </OverviewRow>
  );
}

export function OwnPlanRow({ row }: { row: Row<"ownPlan"> }) {
  const link = { href: row.href, label: "My Plan" };
  if (row.openRequests > 0 && row.firstRequestHref) {
    return (
      <OverviewRow label="Your plan" link={link}>
        <Headline tone="attention" action={<RowAction href={row.firstRequestHref} primary>Record progress</RowAction>}>
          {row.firstRequestBy} asked for an update
        </Headline>
        <p className="mt-1 type-body-secondary text-muted-foreground">
          {row.firstRequestObjective ?? "On your plan"}
          {row.openRequests > 1 ? ` · ${plural(row.openRequests - 1, "more request")}` : ""}
        </p>
      </OverviewRow>
    );
  }

  if (row.standing === "Approved") {
    const status = row.status!;
    const parts = [status.onTrack && `${status.onTrack} on track`, status.atRisk && `${status.atRisk} at risk`, status.offTrack && `${status.offTrack} off track`]
      .filter(Boolean).join(", ");
    if (row.staleObjectives > 0) {
      return (
        <OverviewRow label="Your plan" link={link}>
          <Headline tone="attention" action={<RowAction href={row.href}>Record progress</RowAction>}>
            {row.staleObjectives === 1 ? "1 objective" : `${row.staleObjectives} objectives`} last updated {row.stalestDays} days ago
          </Headline>
          <Facts
            facts={[
              { label: plural(row.objectives, "objective") },
              row.progress !== null && { label: <>Plan <N>{Math.round(row.progress)}%</N></> },
              status.onTrack > 0 && { label: <><N>{status.onTrack}</N> on track</>, tone: "ok" },
              status.atRisk > 0 && { label: <><N>{status.atRisk}</N> at risk</>, tone: "risk" },
              status.offTrack > 0 && { label: <><N>{status.offTrack}</N> off track</>, tone: "off" },
            ]}
          />
        </OverviewRow>
      );
    }
    return (
      <OverviewRow label="Your plan" link={link}>
        <Headline tone={status.offTrack ? "off" : status.atRisk ? "risk" : "ok"}>
          {parts || plural(row.objectives, "objective")}{row.progress !== null ? ` · ${Math.round(row.progress)}%` : ""}
        </Headline>
        <p className="mt-1 type-body-secondary text-muted-foreground">
          {row.lastUpdateAt ? `Last update ${ago(row.lastUpdateAt)}` : "No update yet"}
        </p>
      </OverviewRow>
    );
  }

  if (row.standing === "Submitted") {
    return (
      <OverviewRow label="Your plan" link={link}>
        <Headline tone="attention">Submitted, waiting for {row.reviewerName ?? "your reviewer"}</Headline>
        <p className="mt-1 type-body-secondary text-muted-foreground">
          {plural(row.objectives, "objective")}{row.submittedAt ? ` · submitted ${day(row.submittedAt)}` : ""}
        </p>
      </OverviewRow>
    );
  }

  if (row.standing === "ReturnedForChanges") {
    return (
      <OverviewRow label="Your plan" link={link}>
        <Headline tone="attention" action={<RowAction href={row.href} primary>Revise your plan</RowAction>}>
          {row.returnedBy ? `${row.returnedBy} asked for changes` : "Your plan came back with changes"}
        </Headline>
        {row.returnFeedback ? <p className="mt-2 max-w-2xl type-narrative text-foreground/90">&ldquo;{row.returnFeedback}&rdquo;</p> : null}
      </OverviewRow>
    );
  }

  const draft = row.standing === "Draft";
  const range = row.minObjectives && row.maxObjectives ? `${row.minObjectives} to ${row.maxObjectives} objectives suggested` : null;
  return (
    <OverviewRow label="Your plan" sub={row.planningOpen ? `Due ${day(row.planningDeadline)}` : undefined} link={link}>
      <Headline tone="attention" action={<RowAction href={row.href} primary>{draft ? "Continue your plan" : "Start your plan"}</RowAction>}>
        {draft ? "Your plan is a draft" : "Write your plan"}
      </Headline>
      {draft ? (
        <Facts
          facts={[
            {
              label: `${plural(row.objectives, "objective")}${row.objectives ? `, ${row.alignedObjectives === row.objectives ? (row.objectives === 2 ? "both" : "all") : row.alignedObjectives} aligned` : ""}`,
              tone: row.objectives > 0 && row.alignedObjectives === row.objectives ? "ok" : undefined,
            },
            { label: <>Weights at <N>{Math.round(row.weightTotal)}</N> of 100%</>, tone: Math.round(row.weightTotal) === 100 ? "ok" : "attention" },
            range ? { label: range } : null,
          ]}
        />
      ) : range ? (
        <Facts facts={[{ label: range }]} />
      ) : null}
    </OverviewRow>
  );
}

export function DevelopmentRow({ row }: { row: Row<"development"> }) {
  return (
    <OverviewRow label="Development" sub={plural(row.total, "goal")} link={{ href: row.href, label: "My Plan" }}>
      <Headline tone={row.open > 0 ? "attention" : "ok"} action={<RowAction href={row.href}>Open Development</RowAction>}>
        {row.open === 0 ? "Every growth goal is done" : row.open === 1 ? "1 growth goal is still open" : `${row.open} growth goals are still open`}
      </Headline>
      {row.open > 0 ? <p className="mt-1 type-body-secondary text-muted-foreground">Open goals can carry into the next cycle when it starts.</p> : null}
      <MiniList label="Growth goals">
        {row.goals.map((g) => (
          <MiniItem
            key={g.id}
            href={row.href}
            title={g.title}
            sub={`${g.status === "Done" ? "Done" : g.status === "InProgress" ? "In progress" : "Not started"}${g.targetDate ? ` · target ${day(g.targetDate)}` : ""}`}
            trailing={
              <span className={cn("hidden items-center gap-1.5 type-meta sm:inline-flex", g.status === "Done" ? "text-success" : g.status === "InProgress" ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("size-2 rounded-full", g.status === "Done" ? "bg-success" : g.status === "InProgress" ? "bg-primary" : "bg-muted-foreground")} aria-hidden />
                {g.status === "Done" ? "Done" : g.status === "InProgress" ? "In progress" : "Not started"}
              </span>
            }
          />
        ))}
      </MiniList>
    </OverviewRow>
  );
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function ConversationsRow({ row }: { row: Row<"conversations"> }) {
  const soon = row.meetings[0] ? daysFrom(row.meetings[0].at) : null;
  return (
    <OverviewRow label="Conversations" sub={soon !== null && soon >= 0 && soon <= 7 ? "This week" : undefined} link={{ href: "/one-on-ones", label: "1:1s" }}>
      <div className="grid gap-6 sm:grid-cols-2">
        {row.meetings.map((m, index) => {
          const days = daysFrom(m.at);
          // A meeting stays the series' next until it's completed, so a passed one is overdue rather than gone.
          const overdue = days < 0;
          return (
            <Link key={m.seriesId} href={appHref(m.href)} className="flex items-center gap-4 rounded-control transition-colors hover:bg-card">
              <span className={cn("grid w-14 shrink-0 place-items-center rounded-inset py-1.5 ring-1 ring-inset",
                overdue ? "bg-destructive/10 text-destructive ring-destructive/40"
                  : index === 0 ? "bg-primary/10 text-primary ring-primary/40" : "bg-inlay text-muted-foreground ring-border")}>
                <span className="type-eyebrow">{WEEKDAY.format(new Date(m.at))}</span>
                <span className="type-panel-title tabular-nums">{TIME.format(new Date(m.at))}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate type-label text-foreground">1:1 with {m.with}</span>
                <span className="block truncate type-meta text-muted-foreground">
                  {[overdue ? `Overdue since ${day(m.at.slice(0, 10))}` : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
                    m.agenda ? `${m.agenda} on the agenda` : null, m.openActions ? plural(m.openActions, "open action") : null].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
          );
        })}
        {row.owed ? (
          <div className="flex items-center gap-4">
            <span className="min-w-0 flex-1">
              <span className="block type-label text-foreground">
                {row.owed.kind === "feedback-request" ? `${row.owed.title} asked for your feedback` : `${plural(row.owed.count, "action item")} ${row.owed.count === 1 ? "is" : "are"} overdue`}
              </span>
              <span className="block truncate type-meta text-muted-foreground">
                {row.owed.kind === "feedback-request"
                  ? `${row.owed.context ?? ""}${row.owed.due ? ` · due ${day(row.owed.due)}` : ""}`
                  : `${row.owed.title}${row.owed.due ? ` · was due ${day(row.owed.due)}` : ""}`}
              </span>
            </span>
            <RowAction href={row.owed.href}>{row.owed.kind === "feedback-request" ? "Answer" : "Open the 1:1"}</RowAction>
          </div>
        ) : null}
      </div>
    </OverviewRow>
  );
}

/** Company direction this cycle executes, each objective opening in its record. */
export function DirectionRow({ row, cycleId }: { row: Row<"direction">; cycleId: string }) {
  const record = useObjectiveRecord();
  return (
    <OverviewRow
      label="Organization direction"
      sub={row.final ? "Final results" : plural(row.count, "company objective")}
      link={{ href: withCycle("/goals", cycleId), label: "Open the map" }}
    >
      {/* Unframed like every other row; a track only once the objective has measured progress. */}
      <ul className="divide-y divide-border">
        {row.objectives.map((node: GoalNodeDto) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => record.open({ cycleId, objectiveId: node.id })}
              className="group flex w-full items-center gap-4 rounded-control py-3 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate type-label text-foreground">{node.title}</span>
                <span className="block truncate type-meta text-muted-foreground">
                  {plural(node.childCount, "aligned objective")}{node.accountablePersonName ? `, owned by ${node.accountablePersonName}` : ""}
                </span>
              </span>
              {node.hasProgress ? <ProgressLine value={node.derivedProgress} has className="hidden w-44 shrink-0 sm:flex" /> : null}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </OverviewRow>
  );
}

export function NotParticipantRow({ row }: { row: Row<"notParticipant"> }) {
  return (
    <OverviewRow label="Your plan">
      <Headline>You&apos;re not part of {row.cycleName}</Headline>
      <p className="mt-1 type-body-secondary text-muted-foreground">
        {[row.joined ? `You joined on ${day(row.joined)}` : null, row.populationSetAt ? `its population was set on ${day(row.populationSetAt)}` : null]
          .filter(Boolean).join("; ") || "Your conversations carry on as usual."}
      </p>
    </OverviewRow>
  );
}

export function NoCycleRow({ row }: { row: Row<"noCycle"> }) {
  const readiness = row.readiness;
  return (
    <OverviewRow label="Performance cycle" link={row.canCreate ? { href: "/cycle", label: "Cycle" } : undefined}>
      <Headline action={row.canCreate ? <RowAction href="/cycle/setup/details" primary>Set up a cycle</RowAction> : undefined}>
        No performance cycle yet
      </Headline>
      {readiness ? (
        // What the first cycle would start from (board 16): checked when ready, marked when it needs a look.
        <ul className="mt-4 max-w-3xl divide-y divide-border">
          {readiness.workforceAvailable ? (
            <>
              <ReadinessLine ok={readiness.units > 0} title={`${plural(readiness.units, "unit")} with people in Core HR`} />
              <ReadinessLine
                ok={readiness.withManager === readiness.people}
                title={`${readiness.withManager} of ${plural(readiness.people, "person", "people")} have a manager`}
                detail={readiness.withoutManager.length > 0
                  ? `${readiness.withoutManager.join(", ")}${readiness.people - readiness.withManager > readiness.withoutManager.length ? " and others" : ""} would be left out`
                  : undefined}
              />
            </>
          ) : (
            <ReadinessLine ok={false} title="Core HR couldn't be read" detail="People and managers show once it's back" />
          )}
          <ReadinessLine ok={readiness.ratingLevels > 0 && readiness.competencies > 0} title="Rating scale and competencies" detail={`${plural(readiness.ratingLevels, "level")}, ${plural(readiness.competencies, "competency", "competencies")}`}
            href={row.canCreate ? "/settings" : undefined} />
        </ul>
      ) : null}
    </OverviewRow>
  );
}

function ReadinessLine({ ok, title, detail, href }: { ok: boolean; title: string; detail?: string; href?: string }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-detail", ok ? "bg-success text-background" : "ring-1 ring-inset ring-warning")}>
        {ok ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-label text-foreground">{title}<span className="sr-only">{ok ? " (ready)" : " (needs a look)"}</span></span>
        {detail ? <span className="block type-meta text-muted-foreground">{detail}</span> : null}
      </span>
      {href ? <Link href={href} className="type-meta text-muted-foreground hover:text-foreground">Settings</Link> : null}
    </li>
  );
}

/** With no cycle, conversations still work: the people this person can start 1:1s with (board 16). */
export function StartConversationsRow() {
  const oneOnOnes = useOneOnOnes();
  const people = [
    ...(oneOnOnes.data?.startWithManager ? [oneOnOnes.data.startWithManager.with] : []),
    ...(oneOnOnes.data?.startWithReports.map((option) => option.with) ?? []),
  ];
  if (people.length === 0) return null;
  return (
    <OverviewRow label="Conversations" link={{ href: "/one-on-ones", label: "1:1s" }}>
      <Headline>Start your 1:1s</Headline>
      <ul className="mt-3 flex flex-wrap gap-2">
        {people.slice(0, 6).map((person) => (
          <li key={person.employeeId}>
            <Link href="/one-on-ones" className="flex items-center gap-2.5 rounded-control bg-card px-3 py-2 hover:bg-inlay">
              <PersonInitials name={person.displayName} size="sm" />
              <span className="type-label text-foreground">{person.displayName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </OverviewRow>
  );
}
