"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { ReviewRoundDto, ReviewStage, ReviewStageProgressDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ds/components/ui/popover";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageContainer, PagePermissionNotice, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { AvatarStack, PersonInitials } from "@repo/performance-ui";
import { Bell, CalendarDays, Check, FileText, Send } from "@/lib/icons";
import { RecordCycleScope, useWorkspaceContext } from "../../api/use-workspace";
import { useReviewRound, useReviewRoundFinalization, useReviewRoundMutations } from "../../api/use-reviews";
import { useScheduleCommands } from "../../api/use-review-work";
import { useApis } from "../../api/use-performance";
import { ContentUnavailable } from "../content-unavailable";
import { PerformancePageHeading } from "../performance-page-heading";
import { formatDateRange } from "../../lib";
import { calibrationHref, reviewHref, withCycle } from "@/lib/performance-routes";
import { CountTile, DueChip, SectionHeading, dayLabel } from "./review-parts";
import { RoundSetup } from "./round-setup";
import { useRecentRecord } from "@repo/api/react";

/** One round's page in each state (boards 04–07): setup while Draft, monitoring while running, the outcome once closed. */
export function RoundPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const context = useWorkspaceContext();
  const isAdmin = context.data?.capabilities.administers ?? false;
  const query = useReviewRound(roundId, isAdmin);
  useRecentRecord(
    "performance",
    query.data ? { label: query.data.name, kind: "Review round", href: `/performance/reviews/rounds/${query.data.id}` } : null,
  );
  if (context.isLoading || (isAdmin && query.isLoading)) return <PageSkeleton rows={7} width="wide" label="Loading the round" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (!isAdmin) return <PagePermissionNotice title="Administration only" description="Review rounds are run by Performance administrators." />;
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="Review round" />;
  const round = query.data;
  if (!round) return <PageSkeleton rows={7} width="wide" label="Loading the round" />;
  const canCalibrate = context.data?.capabilities.canCalibrate ?? false;

  return (
    <RecordCycleScope cycleId={round.cycleId}>
      <PageContainer width="wide">
        <PerformancePageHeading
          back={{ href: withCycle("/reviews", round.cycleId), label: "Reviews" }}
          title={<span className="inline-flex flex-wrap items-center gap-3">{round.name}<RoundBadge round={round} /></span>}
          description={describe(round)}
          actions={round.state === "Active" ? <RunningActions round={round} canCalibrate={canCalibrate} /> : null}
        />
        {round.state === "Draft" ? <RoundSetup round={round} /> : round.state === "Active" ? <RoundRunning round={round} /> : <RoundClosed round={round} />}
      </PageContainer>
    </RecordCycleScope>
  );
}

/** Sits inside the page title, so it resets to the system face rather than inherit the title's serif. */
function RoundBadge({ round }: { round: ReviewRoundDto }) {
  return round.state === "Active" ? <StatusBadge className="font-sans" tone="warning" dot>Running</StatusBadge>
    : round.state === "Draft" ? <StatusBadge className="font-sans" tone="neutral" dot>Draft</StatusBadge>
    : <StatusBadge className="font-sans" tone="muted" dot>Closed</StatusBadge>;
}

function describe(round: ReviewRoundDto): string {
  if (round.state === "Draft") return `${round.cycleName} · saved as you go`;
  const people = round.progress ? round.progress.stages.find((s) => s.stage === "ManagerAssessment")?.total ?? 0 : round.outcome?.total ?? 0;
  if (round.state === "Active")
    return `Launched ${dayLabel(round.launchedAt?.slice(0, 10))} · ${people} ${people === 1 ? "person" : "people"} · ${formatDateRange(round.periodStart, round.periodEnd)}`;
  return `${formatDateRange(round.periodStart, round.periodEnd)}${round.outcome?.releasedAt ? ` · released ${dayLabel(round.outcome.releasedAt.slice(0, 10))}` : ""}`;
}

// ── Running (board 06) ─────────────────────────────────────────────────────────────

function RunningActions({ round, canCalibrate }: { round: ReviewRoundDto; canCalibrate: boolean }) {
  const finalize = useReviewRoundFinalization(round.id, round.cycleId);
  const { close } = useReviewRoundMutations(round.cycleId, round.id);
  const ready = round.progress?.readyToFinalize ?? 0;
  const manager = round.progress?.stages.find((s) => s.stage === "ManagerAssessment");
  const resolved = round.progress ? round.progress.finalized + round.progress.closed : 0;
  const total = (manager?.total ?? 0) + (round.progress?.closed ?? 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MoveDueDates round={round} />
      {round.calibrationEnabled && canCalibrate ? (
        <Button variant="outline" asChild><Link href={withCycle(calibrationHref(round.id), round.cycleId)}>Calibration</Link></Button>
      ) : null}
      {total > 0 && resolved === total ? (
        <AsyncButton pending={close.isLoading} onClick={() => void close.mutateAsync(round.version)
          .then(() => toast.success("Round closed."))
          .catch((error) => toast.error(error instanceof Error ? error.message : "The round couldn't close."))}>
          Close round
        </AsyncButton>
      ) : (
        <AsyncButton pending={finalize.isLoading} disabled={ready === 0} onClick={() => void finalize.mutateAsync(round.version)
          .then((result) => toast.success(`${result.finalized.length} ${result.finalized.length === 1 ? "review" : "reviews"} released.`))
          .catch((error) => toast.error(error instanceof Error ? error.message : "Ready reviews couldn't be released."))}>
          <Send className="size-4" aria-hidden />{ready ? `Finalize and release ${ready}` : "Finalize and release"}
        </AsyncButton>
      )}
    </div>
  );
}

const STAGES: { stage: ReviewStage; label: string; key: "selfAssessment" | "peerInput" | "managerAssessment" }[] = [
  { stage: "SelfAssessment", label: "Self-assessment", key: "selfAssessment" },
  { stage: "PeerInput", label: "Peer input", key: "peerInput" },
  { stage: "ManagerAssessment", label: "Manager assessment", key: "managerAssessment" },
];

/** HR moves one or more stage dates for the whole round, with a reason; everyone affected is told (D-02). */
function MoveDueDates({ round }: { round: ReviewRoundDto }) {
  const { moveRound } = useScheduleCommands();
  const { performance } = useApis();
  const [open, setOpen] = useState(false);
  const stages = STAGES.filter((s) => s.stage === "SelfAssessment" ? round.selfAssessmentEnabled : s.stage === "PeerInput" ? round.peerInputEnabled : true);
  const current = (key: (typeof STAGES)[number]["key"]) => round.schedule[key].date;
  const [dates, setDates] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const changed = stages.filter((s) => dates[s.key] && dates[s.key] !== current(s.key));
  const submit = async () => {
    try {
      for (const [index, stage] of changed.entries()) {
        // Each move changes the round's version: read it again before the next one.
        const version = index === 0 ? round.version : (await performance.getReviewRound(round.id)).version;
        await moveRound.mutateAsync({ roundId: round.id, request: { expectedVersion: version, stage: stage.stage, dueDate: dates[stage.key]!, reason: reason.trim() } });
      }
      toast.success("Due dates moved. Everyone affected was told.");
      setOpen(false);
      setDates({});
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The due dates couldn't move.");
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline"><CalendarDays className="size-4" aria-hidden />Due dates</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-5">
        <p className="type-panel-title text-foreground">Move due dates</p>
        <p className="mt-0.5 type-meta text-muted-foreground">Everyone affected is notified · recorded in the round activity</p>
        <div className="mt-4 space-y-2.5">
          {stages.map((stage) => (
            <div key={stage.key} className="flex items-center gap-3">
              <span className="flex-1 type-label text-foreground">{stage.label}</span>
              {dates[stage.key] && dates[stage.key] !== current(stage.key) ? <span className="type-meta text-muted-foreground line-through">{dayLabel(current(stage.key))}</span> : null}
              <Input type="date" aria-label={`${stage.label} due`} className="w-40" min={round.schedule.launchDay} max={round.cycleEnd}
                value={dates[stage.key] ?? current(stage.key)} onChange={(event) => setDates({ ...dates, [stage.key]: event.target.value })} />
            </div>
          ))}
        </div>
        <Textarea className="mt-4" aria-label="Reason" placeholder="Why the dates move" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <AsyncButton pending={moveRound.isLoading} disabled={changed.length === 0 || !reason.trim()} onClick={() => void submit()}>
            {changed.length > 1 ? "Move dates" : "Move date"}
          </AsyncButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RoundRunning({ round }: { round: ReviewRoundDto }) {
  const progress = round.progress!;
  const today = new Date().toISOString().slice(0, 10);
  const stage = (name: string) => progress.stages.find((s) => s.stage === name);
  const self = stage("SelfAssessment");
  const peers = stage("PeerInput");
  const manager = stage("ManagerAssessment");
  const released = stage("Released");
  const lists = progress.teams.reduce((sum, t) => sum + t.listsToApprove, 0);
  const tile = (s: ReviewStageProgressDto | undefined, label: string, foot: string, tone: "success" | "primary" = "success") => s ? (
    <CountTile label={label} value={s.done} total={s.total} tone={tone} foot={foot}
      aside={s.dueDate ? <DueChip date={s.dueDate} late={s.dueDate < today && s.open > 0} label={`Due ${dayLabel(s.dueDate)}`} /> : null} />
  ) : null;

  return (
    <div className="space-y-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile(self, "Self-assessments", `${self?.open ?? 0} open${self?.late ? ` · ${self.late} late` : ""}`)}
        {tile(peers, "Peer input", `${peers?.declined ?? 0} declined${lists ? ` · ${lists} ${lists === 1 ? "list" : "lists"} to approve` : ""}`)}
        {tile(manager, "Manager reviews", `${manager?.readyToWrite ?? 0} ready to write`, "primary")}
        {released ? <CountTile label="Released" value={released.done} total={released.total} foot={round.calibrationEnabled ? "After calibration" : `${progress.readyToFinalize} ready to release`} /> : null}
      </div>

      <section aria-labelledby="teams-heading">
        <SectionHeading id="teams-heading" title="By team" count={progress.teams.length} aside="Furthest behind first" />
        <div className="overflow-x-auto rounded-surface bg-card">
          <table className="w-full min-w-[52rem] text-left">
            <thead className="bg-inlay">
              <tr className="type-meta text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-semibold">Team</th>
                {round.selfAssessmentEnabled ? <th scope="col" className="px-3 py-3 font-semibold">Self</th> : null}
                {round.peerInputEnabled ? <th scope="col" className="px-3 py-3 font-semibold">Peers</th> : null}
                <th scope="col" className="px-3 py-3 font-semibold">Manager</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Attention</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {progress.teams.map((team, index) => (
                <tr key={team.reviewerEmployeeId}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <PersonInitials name={team.reviewerDisplayName} size="md" />
                      <div className="min-w-0">
                        <p className="type-label text-foreground">{team.orgUnitName ?? team.reviewerDisplayName}</p>
                        <p className="type-meta text-muted-foreground">{team.reviewerDisplayName} · {team.people} {team.people === 1 ? "person" : "people"}</p>
                      </div>
                    </div>
                  </td>
                  {round.selfAssessmentEnabled ? <td className="px-3 py-3.5"><RatioBar done={team.self.done} total={team.self.total} warn={index === 0 && team.self.done * 2 < team.self.total} /></td> : null}
                  {round.peerInputEnabled ? <td className="px-3 py-3.5"><RatioBar done={team.peers.done} total={team.peers.total} /></td> : null}
                  <td className="px-3 py-3.5"><span className="type-body tabular-nums text-foreground">{team.manager.done}/{team.manager.total}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    {team.listsToApprove ? <StatusBadge tone="warning" dot>{team.listsToApprove} {team.listsToApprove === 1 ? "list" : "lists"} to approve</StatusBadge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="reminders-heading">
          <h2 id="reminders-heading" className="mb-3 type-meta text-muted-foreground">Reminders</h2>
          <div className="rounded-surface bg-card p-5">
            {progress.nextReminder ? (
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary"><Bell className="size-4" aria-hidden /></span>
                <div>
                  <p className="type-label text-foreground">Next: {dayLabel(progress.nextReminder.date)}</p>
                  <p className="type-meta text-muted-foreground">{reminderCounts(progress.nextReminder)}</p>
                </div>
              </div>
            ) : <p className="type-body-secondary text-muted-foreground">Nothing open to remind.</p>}
            <p className="mt-3 type-meta text-muted-foreground">3 days before each due date, the day after, then weekly · in-app and email</p>
          </div>
        </section>
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="mb-3 type-meta text-muted-foreground">Round activity</h2>
          <Activity round={round} />
        </section>
        <section aria-labelledby="config-heading">
          <h2 id="config-heading" className="mb-3 type-meta text-muted-foreground">Configuration · frozen at launch</h2>
          <FrozenConfiguration round={round} />
        </section>
      </div>
    </div>
  );
}

function reminderCounts(next: NonNullable<NonNullable<ReviewRoundDto["progress"]>["nextReminder"]>) {
  return [
    next.selfAssessments ? `${next.selfAssessments} self-assessments` : null,
    next.peerLists ? `${next.peerLists} peer lists` : null,
    next.peerInputs ? `${next.peerInputs} peer answers` : null,
    next.managerAssessments ? `${next.managerAssessments} manager reviews` : null,
  ].filter(Boolean).join(" · ");
}

function RatioBar({ done, total, warn = false }: { done: number; total: number; warn?: boolean }) {
  if (total === 0) return <span className="type-meta text-muted-foreground">–</span>;
  const share = total ? (done / total) * 100 : 0;
  return (
    <span className="flex items-center gap-3">
      <span className="h-1.5 w-32 overflow-hidden rounded-full bg-inlay"><span className={cn("block h-full rounded-full", warn ? "bg-warning" : "bg-success")} style={{ width: `${share}%` }} /></span>
      <span className="type-meta tabular-nums text-muted-foreground">{done}/{total}</span>
    </span>
  );
}

function Activity({ round }: { round: ReviewRoundDto }) {
  if (round.activity.length === 0) return <p className="type-body-secondary text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-4">
      {round.activity.slice(0, 6).map((entry, index) => (
        <li key={`${entry.kind}-${entry.at}-${index}`} className="flex gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-background"><Check className="size-3" aria-hidden /></span>
          <div className="min-w-0">
            <p className="type-label text-foreground">{entry.text}</p>
            <p className="type-meta text-muted-foreground">{[dayLabel(entry.at.slice(0, 10)), entry.actorName].filter(Boolean).join(" · ")}</p>
            {entry.detail ? <p className="mt-0.5 type-body-secondary text-muted-foreground">{entry.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function FrozenConfiguration({ round }: { round: ReviewRoundDto }) {
  const config = round.configuration;
  if (!config) return null;
  const chips: string[] = [
    ...(config.selfAssessment ? ["Self"] : []),
    ...(config.peerInput ? ["Peers"] : []),
    ...(config.objectiveRatings ? ["Objective ratings"] : []),
    ...(config.competencies.length ? [`${config.competencies.length} ${config.competencies.length === 1 ? "competency" : "competencies"}`] : []),
    ...(config.questions || config.peerInput ? [`${round.questions.length} questions`] : []),
    ...(config.potential ? ["Potential"] : []),
    ...(config.calibration ? ["Calibration"] : []),
  ];
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Frozen configuration">
      {chips.map((chip) => <li key={chip} className="rounded-control bg-card px-2.5 py-1 type-meta font-medium text-foreground">{chip}</li>)}
    </ul>
  );
}

// ── Closed (board 07) ──────────────────────────────────────────────────────────────

function RoundClosed({ round }: { round: ReviewRoundDto }) {
  const outcome = round.outcome!;
  const max = Math.max(1, ...outcome.distribution.map((b) => b.count));
  const top = outcome.distribution.reduce((best, b) => (b.count > best.count ? b : best), outcome.distribution[0] ?? { value: 0, label: "", count: 0 });
  return (
    <div className="space-y-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountTile label="Released" value={outcome.released} foot={`of ${outcome.total} reviews`} />
        <CountTile label="Acknowledged" value={outcome.acknowledged} total={outcome.released}
          foot={outcome.notAcknowledged.length ? `${outcome.notAcknowledged.length} not yet` : "Everyone"} />
        <CountTile label="Calibrated" value={outcome.calibratedChanged}
          foot={outcome.calibratedChanged ? `ratings changed · ${outcome.calibratedDown} down, ${outcome.calibratedUp} up` : "No rating changed"} />
        <CountTile label="Closed without a result" value={outcome.closedWithoutResult.length} foot={outcome.closedWithoutResult.length ? "each with a reason" : "None"} />
      </div>

      <section aria-labelledby="ratings-heading" className="rounded-surface bg-card p-6">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 id="ratings-heading" className="type-section-title text-foreground">Final ratings</h2>
          <span className="type-meta text-muted-foreground">{outcome.released} released</span>
        </div>
        <div className="grid h-56 items-end gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, outcome.distribution.length)}, minmax(0, 1fr))` }}
          role="img" aria-label={outcome.distribution.map((b) => `${b.label} ${b.count}`).join(", ")}>
          {outcome.distribution.map((bucket) => (
            <div key={bucket.value} className="flex h-full flex-col items-center justify-end gap-2">
              <span className="type-label tabular-nums text-foreground">{bucket.count}</span>
              <span className={cn("w-full rounded-control", bucket.value === top.value ? "bg-primary" : "bg-primary/60")}
                style={{ height: `${Math.max(4, (bucket.count / max) * 100)}%` }} />
              <span className="text-center type-meta text-muted-foreground">{bucket.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="closed-heading">
          <h2 id="closed-heading" className="mb-3 type-meta text-muted-foreground">Closed without a result</h2>
          {outcome.closedWithoutResult.length ? (
            <ul className="divide-y divide-border rounded-surface bg-card">
              {outcome.closedWithoutResult.map((closed) => (
                <li key={closed.reviewId}>
                  <Link href={reviewHref(closed.reviewId)} className="flex items-center gap-3 px-4 py-3 hover:bg-inlay/60">
                    <PersonInitials name={closed.subjectDisplayName} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block type-label text-foreground">{closed.subjectDisplayName}</span>
                      <span className="block type-meta text-muted-foreground">{closed.reason}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="type-body-secondary text-muted-foreground">None.</p>}
        </section>
        <section aria-labelledby="unack-heading">
          <h2 id="unack-heading" className="mb-3 type-meta text-muted-foreground">Not acknowledged yet · {outcome.notAcknowledged.length}</h2>
          {outcome.notAcknowledged.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <AvatarStack names={outcome.notAcknowledged.map((p) => p.displayName)} size="sm" max={4} />
              {outcome.nextAcknowledgementReminder ? <span className="type-meta text-muted-foreground">Next reminder {dayLabel(outcome.nextAcknowledgementReminder)}</span> : null}
            </div>
          ) : <p className="type-body-secondary text-muted-foreground">Everyone has acknowledged.</p>}
        </section>
        <section aria-labelledby="records-heading">
          <h2 id="records-heading" className="mb-3 type-meta text-muted-foreground">Records</h2>
          <RecordsTile released={outcome.released} />
        </section>
      </div>
    </div>
  );
}

function RecordsTile({ released }: { released: number }): ReactNode {
  return (
    <div className="flex items-center gap-3 rounded-surface bg-card px-4 py-3.5">
      <span className="flex size-9 items-center justify-center rounded-control bg-inlay text-muted-foreground"><FileText className="size-4" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block type-label text-foreground">{released} review {released === 1 ? "PDF" : "PDFs"}</span>
        <span className="block type-meta text-muted-foreground">One per person, from the released record</span>
      </span>
    </div>
  );
}
