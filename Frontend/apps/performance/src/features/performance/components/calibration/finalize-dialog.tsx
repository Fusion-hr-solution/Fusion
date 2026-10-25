"use client";

import { toast } from "sonner";
import type { CalibrationSessionDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ds/components/ui/dialog";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { AsyncButton } from "@repo/ds/shell";
import { PersonInitials } from "@repo/performance-ui";
import { Check, Eye, Lock, FileCheck2, Users } from "@/lib/icons";
import { useCalibrationFinalizePreview, type useCalibrationMutations } from "../../api/use-calibration";
import { flagText } from "./calibration-format";

type Mutations = ReturnType<typeof useCalibrationMutations>;

/** Board 09: one confirmation for one irreversible step: what moves, who wasn't discussed, who sees what next. */
export function FinalizeDialog({ session, roundId, open, mutations, onClose, onOpenPerson }: {
  session: CalibrationSessionDto;
  roundId: string;
  open: boolean;
  mutations: Mutations;
  onClose: () => void;
  onOpenPerson: (reviewId: string) => void;
}) {
  const preview = useCalibrationFinalizePreview(roundId, open);
  const data = preview.data;
  const changed = data ? data.ratingsUp + data.ratingsDown : 0;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !mutations.finalize.isLoading) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="type-page-title">Finalize calibration</DialogTitle>
          <DialogDescription>{session.reviewRoundName}{data ? ` · ${data.people} people` : ""}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <div className="space-y-3" role="status" aria-label="Loading">
            {preview.error ? <p className="text-sm text-destructive" role="alert">{preview.error.message}</p> : <Skeleton className="h-24 rounded-surface" />}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2.5">
              <Fact label="Ratings changed" value={changed} detail={`${data.ratingsDown} down · ${data.ratingsUp} up`} />
              <Fact label="Potential changed" value={data.potentialUp + data.potentialDown} detail={`${data.potentialUp} up · ${data.potentialDown} down`} />
              <Fact label="Not discussed" value={data.notDiscussed} detail={`${data.flaggedNotDiscussed.length} flagged`} />
            </div>
            {data.flaggedNotDiscussed.length > 0 ? (
              <ul className="divide-y divide-border rounded-surface bg-card">
                {data.flaggedNotDiscussed.map((person) => (
                  <li key={person.reviewId} className="flex items-center gap-3 px-4 py-3">
                    <PersonInitials name={person.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block type-label text-foreground">{person.name}</span>
                      <span className="block type-meta text-muted-foreground">{person.flags.map(flagText).join(" · ")} · not discussed</span>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => { onClose(); onOpenPerson(person.reviewId); }}>Open</Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="space-y-3">
              <p className="type-label text-foreground">When you finalize</p>
              <Next icon={Lock}>Ratings and potential lock. The session can&apos;t be reopened.</Next>
              <Next icon={FileCheck2}>{data.people} reviews move to <b>Ready to release</b>.</Next>
              <Next icon={Users}>The {data.reviewers} managers see their people&apos;s final ratings, and the reason for each of the {changed} changes.</Next>
              <Next icon={Eye}>Employees see nothing until you release results from the round.</Next>
            </div>
            {mutations.finalize.error ? <p className="text-sm text-destructive" role="alert">{mutations.finalize.error.message}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutations.finalize.isLoading}>Keep discussing</Button>
          <AsyncButton pending={mutations.finalize.isLoading} disabled={!data || data.outstanding > 0}
            onClick={async () => {
              try {
                await mutations.finalize.mutateAsync(session.version);
                toast.success("Calibration finalized.");
                onClose();
              } catch { /* shown above */ }
            }}>
            <Check className="size-4" aria-hidden />Finalize
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-control bg-inlay px-3.5 py-3">
      <p className="type-meta text-muted-foreground">{label}</p>
      <p className="mt-1 type-metric tabular-nums text-foreground">{value}</p>
      <p className="type-meta text-muted-foreground">{detail}</p>
    </div>
  );
}

function Next({ icon: Icon, children }: { icon: typeof Lock; children: React.ReactNode }) {
  return (
    <p className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2.5 type-body text-foreground">
      <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
