"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, type CalibrationSessionDto, type CalibrationSubjectDto } from "@repo/api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ds/components/ui/alert-dialog";
import { Button } from "@repo/ds/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ds/components/ui/dialog";
import {
  DataTable,
  DataTableCellEmpty,
  DataTableCellStack,
  DataTableRowChevron,
  createDataTableColumnHelper,
  useDataTable,
  type DataTableFilterField,
} from "@repo/ds/data-table";
import { AsyncButton, PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { Check, Users } from "@/lib/icons";
import { withCycle } from "@/lib/performance-routes";
import { RecordCycleScope, useWorkspaceContext } from "../../api/use-workspace";
import { useReview } from "../../api/use-reviews";
import { useCalibrationMutations, useCalibrationSession, useFacilitatorCandidates } from "../../api/use-calibration";
import { ContentUnavailable } from "../content-unavailable";
import { PerformancePageHeading } from "../performance-page-heading";
import { CalibrationDistribution } from "./calibration-distribution";
import { CalibrationFocusPanel } from "./calibration-focus-panel";
import { discussionState, filterOptions, levelLabel, subjectFilterValue } from "./calibration-model";

export function CalibrationWorkspacePage({ roundId }: { roundId: string }) {
  const context = useWorkspaceContext();
  const canCalibrate = context.data?.capabilities.canCalibrate ?? false;
  const session = useCalibrationSession(roundId, canCalibrate);
  const mutations = useCalibrationMutations(roundId, session.data?.cycleId ?? context.data?.selected?.id ?? null);

  if (context.isLoading || (canCalibrate && session.isLoading)) return <PageSkeleton rows={7} width="wide" label="Loading calibration" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Calibration" />;
  if (!canCalibrate) return <PagePermissionNotice title="Calibration unavailable" description="Calibration is open to people who facilitate rating calibration." />;
  const status = session.error instanceof ApiError ? session.error.status : null;
  if (status === 403) return <PagePermissionNotice title="You are not a facilitator of this session" description="A facilitator of this calibration can add you." />;
  if (status === 404) {
    return (
      <PageContainer width="wide">
        <PerformancePageHeading
          title="Calibration"
          eyebrow="Not started"
          back={{ href: withCycle("/reviews", context.data?.selected?.id), label: "Reviews" }}
          actions={<AsyncButton pending={mutations.open.isLoading} onClick={() => { void mutations.open.mutateAsync().catch(() => undefined); }}>Start calibration</AsyncButton>}
        />
        {mutations.open.error ? <p className="text-sm text-destructive" role="alert">{mutations.open.error.message}</p> : null}
      </PageContainer>
    );
  }
  if (session.error) return <ContentUnavailable error={session.error} onRetry={session.refetch} subject="Calibration" />;
  if (!session.data) return <PageSkeleton rows={7} width="wide" label="Loading calibration" />;
  return <RecordCycleScope cycleId={session.data.cycleId}><CalibrationWorkspace session={session.data} roundId={roundId} mutations={mutations} /></RecordCycleScope>;
}

type Mutations = ReturnType<typeof useCalibrationMutations>;

export function CalibrationWorkspace({ session, roundId, mutations }: { session: CalibrationSessionDto; roundId: string; mutations: Mutations }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = session.subjects.find((subject) => subject.reviewId === selectedId) ?? null;
  const review = useReview(selected?.reviewId ?? null, Boolean(selected) && selected?.reviewState === "Calibration");
  const open = session.state === "Open";
  const counts = session.counts;

  return (
    <PageContainer width="wide">
      <PerformancePageHeading
        title={session.reviewRoundName}
        eyebrow={open ? "Calibration" : "Calibration · Finalized"}
        back={{ href: withCycle("/reviews", session.cycleId), label: "Reviews" }}
        actions={open ? <FinalizeAction session={session} mutations={mutations} /> : null}
      />

      <section aria-label="Calibration progress" className="border-y border-border">
        <dl className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
          <Count label="People" value={counts.subjects} />
          <Count label="Discussed" value={counts.discussed} />
          <Count label="Adjusted" value={counts.adjusted} />
          <Count label="Remaining" value={counts.remaining} emphasis={open && counts.remaining > 0} />
        </dl>
        {session.outstanding.length > 0 ? (
          <p className="border-t border-border py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{session.outstanding.length} still in assessment:</span>{" "}
            {session.outstanding.map((item) => item.subjectDisplayName).join(", ")}
          </p>
        ) : null}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-8">
          <CalibrationDistribution distribution={session.distribution} />
          <SubjectTable session={session} selectedId={selectedId} onSelect={(subject) => setSelectedId(subject.reviewId)} />
        </div>
        <aside aria-label="Selected person" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <div className="rounded-surface border border-border bg-card p-5">
              <CalibrationFocusPanel
                subject={selected}
                scale={session.ratingScale}
                review={review.data}
                reviewLoading={review.isLoading}
                readOnly={!open || selected.reviewState !== "Calibration"}
                pending={mutations.adjust.isLoading}
                error={mutations.adjust.error}
                onSave={(draft) => mutations.adjust.mutateAsync({
                  reviewId: selected.reviewId,
                  rating: draft.rating,
                  rationale: draft.rating === selected.originalRating ? null : draft.rationale.trim(),
                  discussionState: discussionState(draft.discussed),
                  expectedVersion: selected.version,
                })}
              />
            </div>
          ) : (
            <div className="rounded-surface border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
              Select a person to calibrate their rating.
            </div>
          )}
          <Facilitators session={session} roundId={roundId} mutations={mutations} />
        </aside>
      </div>
    </PageContainer>
  );
}

function Count({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="py-4 pr-4 first:pl-0 md:pl-5 [&:nth-child(3)]:pl-0 md:[&:nth-child(3)]:pl-5">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 type-metric", emphasis ? "text-primary-ink" : "text-foreground")}>{value}</dd>
    </div>
  );
}

const column = createDataTableColumnHelper<CalibrationSubjectDto>();

function SubjectTable({ session, selectedId, onSelect }: {
  session: CalibrationSessionDto;
  selectedId: string | null;
  onSelect: (subject: CalibrationSubjectDto) => void;
}) {
  const scale = session.ratingScale;
  const filters = useMemo<DataTableFilterField<CalibrationSubjectDto>[]>(() => {
    const options = filterOptions(session.subjects, scale);
    return [
      { id: "discussed", label: "Discussion", icon: Check, type: "options", single: true, pinned: true,
        options: [{ value: "not-discussed", label: "Not discussed" }, { value: "discussed", label: "Discussed" }],
        value: (row) => subjectFilterValue(row, "discussed") },
      { id: "changed", label: "Change", type: "options", single: true,
        options: [{ value: "changed", label: "Changed" }, { value: "unchanged", label: "Unchanged" }],
        value: (row) => subjectFilterValue(row, "changed") },
      { id: "rating", label: "Rating", type: "options", options: options.rating, value: (row) => subjectFilterValue(row, "rating") },
      { id: "manager", label: "Manager", type: "options", options: options.manager.map((value) => ({ value, label: value })),
        value: (row) => subjectFilterValue(row, "manager") },
      { id: "orgUnit", label: "Organizational unit", type: "options", options: options.orgUnit.map((value) => ({ value, label: value })),
        value: (row) => subjectFilterValue(row, "orgUnit") },
    ];
  }, [session.subjects, scale]);
  const columns = useMemo(() => [
    column.accessor((row) => row.subjectDisplayName, {
      id: "person",
      header: "Person",
      cell: ({ row }) => (
        <DataTableCellStack
          primary={<span className={cn(row.original.reviewId === selectedId && "text-primary-ink")}>{row.original.subjectDisplayName}</span>}
          secondary={row.original.orgUnitName ?? undefined}
        />
      ),
    }),
    column.accessor((row) => row.reviewerDisplayName, { id: "manager", header: "Manager", meta: { hideBelow: "md" } }),
    column.accessor((row) => row.currentRating, {
      id: "rating",
      header: "Rating",
      cell: ({ row }) => row.original.adjusted ? (
        <span className="text-sm text-foreground">
          <span className="text-muted-foreground line-through decoration-muted-foreground/60">{levelLabel(scale, row.original.originalRating)}</span>
          <span className="ml-2 font-medium">{levelLabel(scale, row.original.currentRating)}</span>
        </span>
      ) : <span className="text-sm text-foreground">{levelLabel(scale, row.original.currentRating)}</span>,
    }),
    column.accessor((row) => row.discussionState, {
      id: "discussion",
      header: "Discussed",
      enableSorting: false,
      cell: ({ row }) => row.original.discussionState === "Discussed"
        ? <span className="inline-flex items-center gap-1.5 text-sm text-foreground"><Check className="size-4 text-success" aria-hidden />Discussed</span>
        : <DataTableCellEmpty>Not yet</DataTableCellEmpty>,
      meta: { hideBelow: "sm" },
    }),
    column.display({ id: "open", header: () => <span className="sr-only">Open</span>, cell: () => <DataTableRowChevron />, meta: { align: "end", width: "3rem" } }),
  ], [scale, selectedId]);
  const model = useDataTable({
    data: session.subjects,
    columns,
    getRowId: (row) => row.reviewId,
    search: (row) => `${row.subjectDisplayName} ${row.reviewerDisplayName} ${row.orgUnitName ?? ""}`,
    filters,
    pageSize: 25,
  });
  return (
    <section aria-labelledby="calibration-people-title" className="space-y-4">
      <h2 id="calibration-people-title" className="type-section-title text-foreground">People</h2>
      <DataTable
        model={model}
        searchPlaceholder="Search people…"
        noun={["person", "people"]}
        noResults="No one matches these filters"
        emptyState={<><Users className="mx-auto size-8 text-muted-foreground/50" aria-hidden /><p className="mt-3 text-sm text-foreground">No one has reached calibration yet</p></>}
        onRowClick={onSelect}
      />
    </section>
  );
}

function FinalizeAction({ session, mutations }: { session: CalibrationSessionDto; mutations: Mutations }) {
  const [open, setOpen] = useState(false);
  const blocked = session.outstanding.length > 0;
  const people = session.counts.subjects;
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!mutations.finalize.isLoading) setOpen(next); }}>
      <AlertDialogTrigger asChild>
        <Button disabled={blocked || people === 0}>Finalize calibration</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalize calibration for {session.reviewRoundName}</AlertDialogTitle>
          <AlertDialogDescription>
            {people} final {people === 1 ? "rating is" : "ratings are"} set from this session and the reviews move to Ready to finalize.
            Ratings can no longer change here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutations.finalize.error ? <p className="text-sm text-destructive" role="alert">{mutations.finalize.error.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutations.finalize.isLoading}>Keep calibrating</AlertDialogCancel>
          <AsyncButton
            pending={mutations.finalize.isLoading}
            onClick={async () => {
              try {
                await mutations.finalize.mutateAsync(session.version);
                toast.success("Calibration finalized.");
                setOpen(false);
              } catch { /* shown in the dialog */ }
            }}
          >
            Finalize calibration
          </AsyncButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Facilitators({ session, roundId, mutations }: { session: CalibrationSessionDto; roundId: string; mutations: Mutations }) {
  const [editing, setEditing] = useState(false);
  const open = session.state === "Open";
  return (
    <section aria-labelledby="calibration-facilitators-title" className="mt-6 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="calibration-facilitators-title" className="type-label text-foreground">Facilitators</h2>
        {open ? <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Change</Button> : null}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {session.facilitators.map((facilitator) => <li key={facilitator.userId}>{facilitator.displayName}</li>)}
      </ul>
      {editing ? <FacilitatorDialog session={session} roundId={roundId} mutations={mutations} onClose={() => setEditing(false)} /> : null}
    </section>
  );
}

function FacilitatorDialog({ session, roundId, mutations, onClose }: {
  session: CalibrationSessionDto; roundId: string; mutations: Mutations; onClose: () => void;
}) {
  const candidates = useFacilitatorCandidates(roundId);
  const [chosen, setChosen] = useState(() => new Set(session.facilitators.map((item) => item.userId)));
  const toggle = (userId: string) => setChosen((current) => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !mutations.setFacilitators.isLoading) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Facilitators</DialogTitle></DialogHeader>
        {candidates.isLoading ? <p className="text-sm text-muted-foreground">Loading people who can calibrate…</p>
          : candidates.error ? <p className="text-sm text-destructive" role="alert">{candidates.error.message}</p>
          : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {(candidates.data ?? []).map((candidate) => (
                <li key={candidate.userId}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm text-foreground">
                    <input type="checkbox" className="size-4 accent-primary" checked={chosen.has(candidate.userId)} onChange={() => toggle(candidate.userId)} />
                    {candidate.displayName}
                  </label>
                </li>
              ))}
            </ul>
          )}
        {mutations.setFacilitators.error ? <p className="text-sm text-destructive" role="alert">{mutations.setFacilitators.error.message}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutations.setFacilitators.isLoading}>Cancel</Button>
          <AsyncButton
            pending={mutations.setFacilitators.isLoading}
            disabled={chosen.size === 0}
            onClick={async () => {
              try { await mutations.setFacilitators.mutateAsync({ userIds: [...chosen], expectedVersion: session.version }); onClose(); } catch { /* shown above */ }
            }}
          >
            Save facilitators
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
