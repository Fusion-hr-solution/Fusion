"use client";

import { ChevronDown, FileText, Link2, Paperclip, Triangle, Type } from "lucide-react";
import type { ReactNode } from "react";
import type { ProgressUpdateDto } from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "../../lib";

/**
 * The read-only progress timeline for one objective, shared by every surface that reads history (the owner's
 * detail drawer today, the manager's read next). Per update it states the resulting progress with its
 * improvement/regression delta, quiet indicators of any note, files, or links attached, and the context note.
 * Newest first; older pages load on demand, and once the whole trail is loaded it resolves on the first update.
 */
export function ProgressHistoryTimeline({
  history,
  toneClass,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  history: ProgressUpdateDto[];
  /** The objective's progress tone (`text-*`) — the node and headline echo the objective's identity colour. */
  toneClass: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <ol className="mt-4">
      {history.map((entry) => {
        const files = entry.evidence.filter((e) => e.kind === "File").length;
        const links = entry.evidence.filter((e) => e.kind === "Link").length;
        const references = entry.evidence.filter((e) => e.kind === "Reference").length;
        const milestoneAction =
          entry.kind === "MilestoneCompleted" ? "Completed" : entry.kind === "MilestoneReopened" ? "Reopened" : null;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5">
            <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" aria-hidden />
            <span className={cn("relative z-10 mt-1 size-2.5 shrink-0 rounded-full", toneClass.replace("text-", "bg-"))} />
            <div className="min-w-0 flex-1">
              {/* Date + attachment/note indicators. */}
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{formatDate(entry.recordedAt.slice(0, 10))}</span>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {entry.contextNote ? <HistoryChip icon={<FileText className="size-3" aria-hidden />} label="Note" /> : null}
                  {files > 0 ? <HistoryChip icon={<Paperclip className="size-3" aria-hidden />} label={`${files} file${files === 1 ? "" : "s"}`} /> : null}
                  {links > 0 ? <HistoryChip icon={<Link2 className="size-3" aria-hidden />} label={`${links} link${links === 1 ? "" : "s"}`} /> : null}
                  {references > 0 ? <HistoryChip icon={<Type className="size-3" aria-hidden />} label={`${references} ref${references === 1 ? "" : "s"}`} /> : null}
                </div>
              </div>

              {/* Resulting progress + its improvement/regression delta. */}
              <div className="mt-0.5 flex items-center gap-2.5">
                <span className={cn("text-xl font-semibold tabular-nums leading-none", toneClass)}>
                  {Math.round(entry.resultingProgress)}%
                </span>
                <DeltaBadge delta={entry.deltaProgress} correction={entry.isCorrection} />
              </div>

              {milestoneAction ? (
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                  {milestoneAction}
                  {entry.milestoneTitle ? <span className="text-muted-foreground"> · {entry.milestoneTitle}</span> : null}
                </p>
              ) : null}

              {entry.contextNote ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{entry.contextNote}</p>
              ) : null}
            </div>
          </li>
        );
      })}

      {/* Older pages load here; once fully loaded the timeline resolves on the first update. */}
      {hasMore ? (
        <li className="relative flex gap-3">
          <span className="relative z-10 mt-1 size-2.5 shrink-0 rounded-full border-2 border-muted-foreground/30 bg-background" />
          <AsyncButton pending={loadingMore} variant="ghost" size="sm" onClick={onLoadMore} className="-ml-1 -mt-1 text-muted-foreground">
            <ChevronDown className="size-3.5" data-icon="inline-start" /> Show earlier updates
          </AsyncButton>
        </li>
      ) : (
        <li className="relative flex gap-3">
          <span className="relative z-10 mt-1 size-2.5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">No earlier updates</p>
            <p className="mt-0.5 text-xs text-muted-foreground">This was the first progress update.</p>
          </div>
        </li>
      )}
    </ol>
  );
}

/** A quiet indicator pill for a note, file, or link attached to a progress update. */
function HistoryChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

/** The signed change from the prior update — green rise, red drop — flagged when it corrects an earlier entry. */
function DeltaBadge({ delta, correction }: { delta: number; correction: boolean }) {
  const rounded = Math.round(delta);
  if (rounded === 0 && !correction) return null;
  const up = rounded > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      )}
    >
      <Triangle className={cn("size-2.5 fill-current", !up && "rotate-180")} aria-hidden />
      {up ? `+${rounded}` : rounded}%{correction ? <span className="ml-1 font-medium opacity-80">· correction</span> : null}
    </span>
  );
}
