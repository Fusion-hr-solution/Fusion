"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@repo/ds/components/ui/alert-dialog";
import { AsyncButton, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { useReviewRound, useReviewRoundMutations } from "@/features/performance/api/use-reviews";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { roundHref, roundSetupHref, withCycle } from "@/lib/performance-routes";

export default function ReviewRoundReadinessPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const roundId = params.roundId;
  const query = useReviewRound(roundId);
  const round = query.data;
  const mutations = useReviewRoundMutations(round?.cycleId ?? "", roundId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (query.isLoading) return <PageSkeleton rows={6} label="Checking round readiness" />;
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="Round readiness" />;
  if (!round) return <PageSkeleton rows={6} label="Checking round readiness" />;
  const currentRound = round;

  const included = round.subjects.filter((subject) => !subject.isExcluded);
  const blocked = included.flatMap((subject) => subject.readinessIssues.map((issue) => ({ subject, issue })));
  const canLaunch = included.length > 0 && blocked.length === 0;

  async function launch() {
    try {
      const result = await mutations.launch.mutateAsync(currentRound.version);
      setConfirmOpen(false);
      toast.success(`${result.reviewCount} reviews launched.`);
      router.push(withCycle(roundHref(currentRound.id), currentRound.cycleId));
    } catch (error) {
      setConfirmOpen(false);
      toast.error(error instanceof Error ? error.message : "The round could not be launched.");
      await query.refetch();
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div><h2 className="type-section-title text-foreground">Ready to launch?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Check the roster and assignment readiness. The server revalidates every person when you launch.</p></div>
        <div className="text-right"><div className="type-page-title tabular-nums text-foreground">{included.length}</div><div className="text-xs text-muted-foreground">included subjects</div></div>
      </div>

      {blocked.length ? (
        <section className="mt-6" aria-labelledby="round-blockers-title">
          <div className="flex items-center gap-2"><h3 id="round-blockers-title" className="type-label text-foreground">Resolve before launch</h3><StatusBadge tone="warning">{blocked.length} issue{blocked.length === 1 ? "" : "s"}</StatusBadge></div>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {blocked.map(({ subject, issue }, index) => <li key={`${subject.participantId}-${issue.code}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><span className="type-label text-foreground">{subject.subjectDisplayName}</span><span className="mx-2 text-muted-foreground" aria-hidden>·</span><span className="text-sm text-muted-foreground">{issueLabel(issue.code)}</span></div><span className="text-sm text-muted-foreground">Reviewer · {subject.reviewerDisplayName ?? "Unassigned"}</span></li>)}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Assign an active reviewer or exclude the person with a reason in the People step.</p>
        </section>
      ) : included.length === 0 ? (
        <p className="mt-6 border-y border-border py-5 text-sm text-muted-foreground">Include at least one subject before launching this round.</p>
      ) : (
        <div className="mt-6 flex items-center gap-3 border-y border-border py-5"><StatusBadge tone="success">Ready</StatusBadge><p className="text-sm text-muted-foreground">Every included subject has an active reviewer and can be assessed.</p></div>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => router.push(withCycle(roundSetupHref(round.id, "population"), round.cycleId))}>Back to people</Button>
        <Button disabled={!canLaunch || mutations.launch.isLoading} onClick={() => setConfirmOpen(true)}>Launch round</Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Launch {currentRound.name}?</AlertDialogTitle>
            <AlertDialogDescription>Fusion will freeze this round’s settings and rating scale, create {included.length} review{included.length === 1 ? "" : "s"}, and notify participants to begin. The population and reviewers cannot be changed after launch.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction asChild><AsyncButton pending={mutations.launch.isLoading} onClick={launch}>Launch {included.length} reviews</AsyncButton></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function issueLabel(code: string) {
  switch (code) {
    case "InactiveSubject": return "Subject is not active for this period";
    case "MissingReviewer": return "A reviewer is missing";
    case "InactiveReviewer": return "Reviewer is not active for this period";
    case "SelfReview": return "Subject cannot review themselves";
    default: return code;
  }
}
