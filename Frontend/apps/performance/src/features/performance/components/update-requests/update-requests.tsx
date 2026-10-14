"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { UpdateRequestDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ds/components/ui/dialog";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { objectiveHref } from "@/lib/performance-routes";
import { usePlanDetail } from "../../api/use-performance";
import { useUpdateRequestMutations, useUpdateRequests } from "../../api/use-update-requests";
import { formatDate } from "../../lib";

/**
 * The responsible reviewer asks for a progress update on the whole plan or one objective, with an optional
 * note. Asking again for the same target returns the request already open, so the action is safe to repeat.
 */
export function RequestUpdateDialog({ cycleId, planId, personName, objective, onClose }: {
  cycleId: string;
  planId: string;
  personName: string;
  /** Fixed when asked from an objective's record; otherwise the reviewer picks a target. */
  objective?: { id: string; title: string };
  onClose: () => void;
}) {
  const plan = usePlanDetail(objective ? null : cycleId, objective ? null : planId);
  const { request } = useUpdateRequestMutations(cycleId, planId);
  const [target, setTarget] = useState<string | null>(objective?.id ?? null);
  const [note, setNote] = useState("");
  const objectives = plan.data?.objectives ?? [];

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !request.isLoading) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ask {personName} for an update</DialogTitle></DialogHeader>
        {objective ? (
          <p className="text-sm text-foreground">{objective.title}</p>
        ) : (
          <fieldset>
            <legend className="type-label text-foreground">Update on</legend>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              <TargetOption name="update-target" checked={target === null} onSelect={() => setTarget(null)} label="The whole plan" />
              {plan.isLoading ? <p className="py-2 text-sm text-muted-foreground">Loading objectives…</p> : null}
              {objectives.map((item) => (
                <TargetOption key={item.id} name="update-target" checked={target === item.id} onSelect={() => setTarget(item.id)} label={item.title} />
              ))}
            </div>
          </fieldset>
        )}
        <div>
          <label htmlFor="update-request-note" className="type-label text-foreground">Note <span className="text-muted-foreground">(optional)</span></label>
          <Textarea id="update-request-note" className="mt-2 min-h-20" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
        {request.error ? <p className="text-sm text-destructive" role="alert">{request.error.message}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={request.isLoading}>Cancel</Button>
          <AsyncButton
            pending={request.isLoading}
            onClick={async () => {
              try {
                await request.mutateAsync({ objectiveId: target, note: note.trim() || null });
                toast.success(`Update requested from ${personName}.`);
                onClose();
              } catch { /* shown above */ }
            }}
          >
            Send request
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetOption({ name, checked, onSelect, label }: { name: string; checked: boolean; onSelect: () => void; label: string }) {
  return (
    <label className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
      checked ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
      <input type="radio" name={name} className="size-4 accent-primary" checked={checked} onChange={onSelect} />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

/**
 * Open requests lead the employee to the existing progress flow. On My Plan, a whole-plan request leads
 * to the objective list; on an objective record, progress on that objective can satisfy it.
 */
export function UpdateRequestMarkers({ requests, cycleId, objectiveId }: {
  requests: UpdateRequestDto[] | undefined;
  cycleId: string;
  /** On an objective record: only requests on this objective or on the whole plan. */
  objectiveId?: string;
}) {
  const open = (requests ?? []).filter((item) => item.state === "Open"
    && (objectiveId === undefined || item.objectiveId === null || item.objectiveId === objectiveId));
  if (open.length === 0) return null;
  return (
    <section aria-labelledby={objectiveId ? "record-update-requests" : "plan-update-requests"} className={objectiveId ? "border-t border-border pt-4" : "mb-8 border-b border-border pb-6"}>
      <div className="flex items-baseline gap-2">
        <h2 id={objectiveId ? "record-update-requests" : "plan-update-requests"} className={objectiveId ? "text-sm font-semibold text-foreground" : "type-section-title text-foreground"}>Updates requested</h2>
        {open.length > 1 ? <span className="type-meta tabular-nums text-muted-foreground">{open.length}</span> : null}
      </div>
      <ul className="mt-3 divide-y divide-border">
        {open.map((item) => {
          const progressObjectiveId = item.objectiveId ?? objectiveId;
          const href = progressObjectiveId
            ? objectiveHref({ cycleId, objectiveId: progressObjectiveId }, "record")
            : "#plan-objectives";
          return (
            <li key={item.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.objectiveTitle ?? "Your plan"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.requestedByName} · {formatDate(item.requestedAt)}</p>
                {item.note ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.note}</p> : null}
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0"><Link href={href}>{progressObjectiveId ? "Record progress" : "Choose objective"}</Link></Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The update-request part of a plan objective's record: the owner sees the open asks that concern this
 * objective; the plan's responsible reviewer can ask, and sees whether an ask is still open.
 */
export function RecordUpdateRequests({ cycleId, planId, objective, ownerName, isOwner, canRequest }: {
  cycleId: string;
  planId: string;
  objective: { id: string; title: string };
  ownerName: string;
  isOwner: boolean;
  canRequest: boolean;
}) {
  const requests = useUpdateRequests(cycleId, planId, isOwner || canRequest);
  const [asking, setAsking] = useState(false);
  if (isOwner) return <div className="mt-4"><UpdateRequestMarkers requests={requests.data} cycleId={cycleId} objectiveId={objective.id} /></div>;
  if (!canRequest) return null;
  const open = requests.data?.find((item) => item.state === "Open" && item.objectiveId === objective.id);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {open ? (
        <p className="text-sm text-muted-foreground">Update requested {formatDate(open.requestedAt)}</p>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAsking(true)}>Request update</Button>
      )}
      {asking ? <RequestUpdateDialog cycleId={cycleId} planId={planId} personName={ownerName} objective={objective} onClose={() => setAsking(false)} /> : null}
    </div>
  );
}

/** My Plan: every open ask on the plan or its objectives, at the top of the executing plan. */
export function PlanUpdateRequests({ cycleId, planId }: { cycleId: string; planId: string }) {
  const requests = useUpdateRequests(cycleId, planId);
  if (requests.error) return <p role="alert" className="mb-6 text-sm text-destructive">Update requests are unavailable. <Button variant="link" size="sm" onClick={requests.refetch}>Retry</Button></p>;
  return <UpdateRequestMarkers requests={requests.data} cycleId={cycleId} />;
}
