"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReviewRoundSubjectDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { useEligibleReviewers, useReviewRound, useReviewRoundMutations } from "@/features/performance/api/use-reviews";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { formatDate } from "@/features/performance/lib";
import { roundSetupHref, withCycle } from "@/lib/performance-routes";

type EditMode = "assign" | "exclude" | "include";

export default function ReviewRoundPopulationPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const roundId = params.roundId;
  const query = useReviewRound(roundId);
  const round = query.data;
  const reviewers = useEligibleReviewers(roundId, Boolean(round));
  const mutations = useReviewRoundMutations(round?.cycleId ?? "", roundId);
  const [target, setTarget] = useState<ReviewRoundSubjectDto | null>(null);
  const [mode, setMode] = useState<EditMode>("assign");
  const [reviewerId, setReviewerId] = useState("");
  const [reviewerFilter, setReviewerFilter] = useState("");
  const [reason, setReason] = useState("");

  if (query.isLoading) return <PageSkeleton rows={8} label="Loading review population" />;
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="Review population" />;
  if (!round) return <PageSkeleton rows={8} label="Loading review population" />;
  const currentRound = round;

  function openEditor(subject: ReviewRoundSubjectDto, nextMode: EditMode) {
    setTarget(subject);
    setMode(nextMode);
    setReviewerId(subject.reviewerEmployeeId ?? "");
    setReviewerFilter("");
    setReason(subject.exclusionReason ?? "");
  }

  async function saveEdit() {
    if (!target) return;
    try {
      await mutations.updatePopulation.mutateAsync({
        expectedVersion: currentRound.version,
        subjects: currentRound.subjects.map((subject) => ({
          participantId: subject.participantId,
          isExcluded: subject.participantId === target.participantId ? mode === "exclude" : subject.isExcluded,
          exclusionReason: subject.participantId === target.participantId
            ? mode === "exclude" ? reason.trim() : null
            : subject.exclusionReason,
          reviewerEmployeeId: subject.participantId === target.participantId ? reviewerId || null : subject.reviewerEmployeeId,
        })),
      });
      setTarget(null);
      await query.refetch();
      toast.success(mode === "exclude" ? "Person excluded from this round." : "Round population updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the round population.");
    }
  }

  const activeSubjects = round.subjects.filter((subject) => !subject.isExcluded);
  const issueCount = activeSubjects.reduce((count, subject) => count + subject.readinessIssues.length, 0);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div><h2 className="type-section-title text-foreground">Subjects and reviewers</h2><p className="mt-1 text-sm text-muted-foreground">The confirmed Cycle roster is the starting point. Reviewers come from recorded responsibility.</p></div>
        <p className="text-sm tabular-nums text-muted-foreground">{activeSubjects.length} included <span aria-hidden>·</span> {round.subjects.length - activeSubjects.length} excluded</p>
      </div>
      {reviewers.error ? <div className="mt-4"><ContentUnavailable error={reviewers.error} onRetry={reviewers.refetch} subject="Reviewer directory" /></div> : null}
      {issueCount > 0 ? <p role="status" className="mt-4 text-sm text-warning-foreground">{issueCount} readiness issue{issueCount === 1 ? "" : "s"} need resolution before launch.</p> : null}

      <div className="mt-3 divide-y divide-border">
        {round.subjects.map((subject) => (
          <article key={subject.participantId} className={`flex flex-wrap items-center gap-x-5 gap-y-3 py-4 ${subject.isExcluded ? "opacity-70" : ""}`}>
            <div className="min-w-56 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="type-label text-foreground">{subject.subjectDisplayName}</h3>{subject.isExcluded ? <StatusBadge tone="muted">Excluded</StatusBadge> : null}</div>
              <p className="mt-1 text-sm text-muted-foreground">Reviewer · {subject.reviewerDisplayName ?? "Unassigned"}{subject.reviewerBasis ? ` · ${labelBasis(subject.reviewerBasis)}` : ""}</p>
              {subject.isExcluded && subject.exclusionReason ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subject.exclusionReason}</p> : null}
              {!subject.isExcluded && subject.readinessIssues.length ? <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${subject.subjectDisplayName} readiness issues`}>{subject.readinessIssues.map((issue) => <li key={issue.code}><StatusBadge tone="warning">{labelIssue(issue.code)}</StatusBadge></li>)}</ul> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditor(subject, "assign")}>Assign reviewer</Button>
              {subject.isExcluded
                ? <Button variant="ghost" size="sm" onClick={() => openEditor(subject, "include")}>Include</Button>
                : <Button variant="ghost" size="sm" onClick={() => openEditor(subject, "exclude")}>Exclude</Button>}
            </div>
          </article>
        ))}
        {round.subjects.length === 0 ? <p className="py-8 text-sm text-muted-foreground">This Cycle has no confirmed participants to review.</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => router.push(withCycle(roundSetupHref(round.id, "details"), round.cycleId))}>Back to details</Button>
        <Button onClick={() => router.push(withCycle(roundSetupHref(round.id, "review"), round.cycleId))}>Review readiness</Button>
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) setTarget(null); }}>
            <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "exclude" ? `Exclude ${target?.subjectDisplayName}?` : mode === "include" ? `Include ${target?.subjectDisplayName}?` : `Assign a reviewer to ${target?.subjectDisplayName}`}</DialogTitle>
            <DialogDescription>{mode === "exclude" ? "Their review is removed from this round. Keep the reason with the decision." : mode === "include" ? "This person returns to the round population." : "Choose an active employee as reviewer. This assignment is recorded for the round."}</DialogDescription>
          </DialogHeader>
          {mode === "exclude" ? (
            <div className="space-y-1.5"><Label htmlFor="round-exclusion-reason">Reason</Label><Textarea id="round-exclusion-reason" value={reason} maxLength={240} onChange={(event) => setReason(event.target.value)} rows={3} autoFocus /></div>
          ) : mode === "assign" ? (
            <div className="space-y-1.5"><Label htmlFor="reviewer-search">Find an active reviewer</Label><Input id="reviewer-search" value={reviewerFilter} placeholder="Filter names or teams" onChange={(event) => setReviewerFilter(event.target.value)} /><select id="reviewer-choice" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="h-10 w-full rounded-control border border-input bg-background px-3 text-sm text-foreground"><option value="">Keep current assignment</option>{target?.reviewerEmployeeId && !(reviewers.data ?? []).some((person) => person.employeeId === target.reviewerEmployeeId) ? <option value={target.reviewerEmployeeId}>Current: {target.reviewerDisplayName} (not active)</option> : null}{(reviewers.data ?? []).filter((person) => `${person.displayName} ${person.jobTitle ?? ""} ${person.orgUnitName ?? ""}`.toLocaleLowerCase().includes(reviewerFilter.toLocaleLowerCase())).map((person) => <option key={person.employeeId} value={person.employeeId}>{person.displayName}{person.jobTitle ? ` · ${person.jobTitle}` : ""}{person.orgUnitName ? ` · ${person.orgUnitName}` : ""}</option>)}</select><p className="text-xs text-muted-foreground">{reviewers.isLoading ? "Loading active employees…" : `${reviewers.data?.length ?? 0} active employees available as of ${formatDate(round.periodStart)}.`}</p></div>
          ) : <p className="text-sm text-muted-foreground">The existing reason will be cleared.</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <AsyncButton pending={mutations.updatePopulation.isLoading} disabled={mode === "exclude" && !reason.trim() || mode === "assign" && (!reviewerId || reviewerId === target?.reviewerEmployeeId || reviewers.isLoading || !reviewers.data?.length)} onClick={saveEdit}>{mode === "exclude" ? "Exclude person" : mode === "include" ? "Include person" : "Save reviewer"}</AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function labelIssue(code: string) {
  switch (code) {
    case "InactiveSubject": return "Inactive subject";
    case "MissingReviewer": return "Reviewer needed";
    case "InactiveReviewer": return "Inactive reviewer";
    case "SelfReview": return "Cannot review self";
    default: return code;
  }
}

function labelBasis(value: string) {
  return value === "AdministrativeAssignment" ? "assigned for this round" : "recorded responsibility";
}
