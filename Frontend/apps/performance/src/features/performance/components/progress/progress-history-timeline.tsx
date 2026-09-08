"use client";

import { ChevronDown, ExternalLink, FileText, Link2, Loader2, Paperclip, Triangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { EvidenceDto, ProgressUpdateDto } from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "../../lib";

/**
 * The read-only progress timeline for one objective, shared by every surface that reads history (the
 * owner's detail drawer and the manager's read of the same plan). Per update it states the resulting
 * progress with its improvement/regression delta and quiet chips for any note, files, or links attached.
 *
 * Each row is compact by default and expands in place to reveal the update's note and its evidence —
 * files by real filename and size, links by label or hostname, each with a plain Open action. Evidence
 * stays attached to the update that introduced it; nothing opens a second drawer. Newest first; older
 * pages load on demand, and once the whole trail is loaded it resolves on the first update.
 */
export function ProgressHistoryTimeline({
  history,
  toneClass,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenFile,
  openingFileId,
}: {
  history: ProgressUpdateDto[];
  /** The objective's progress tone (`text-*`) — the node and headline echo the objective's identity colour. */
  toneClass: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Opens a file-evidence item through the authenticated client (a plain link cannot carry the bearer token). */
  onOpenFile: (evidenceId: string) => void;
  /** The file-evidence id currently being fetched, so its row can show progress. */
  openingFileId: string | null;
}) {
  return (
    <ol className="mt-4">
      {history.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} toneClass={toneClass} onOpenFile={onOpenFile} openingFileId={openingFileId} />
      ))}

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

/** One update in the timeline — compact by default, expanding in place to its note and evidence. */
function HistoryRow({
  entry,
  toneClass,
  onOpenFile,
  openingFileId,
}: {
  entry: ProgressUpdateDto;
  toneClass: string;
  onOpenFile: (evidenceId: string) => void;
  openingFileId: string | null;
}) {
  const files = entry.evidence.filter((e) => e.kind === "File");
  const links = entry.evidence.filter((e) => e.kind === "Link");
  const openable = entry.evidence.filter((e) => e.kind === "File" || e.kind === "Link");
  const milestoneAction =
    entry.kind === "MilestoneCompleted" ? "Completed" : entry.kind === "MilestoneReopened" ? "Reopened" : null;
  // A row reveals something only when it carries a note or evidence; otherwise it stays a flat entry.
  const expandable = Boolean(entry.contextNote) || openable.length > 0;
  const [open, setOpen] = useState(false);
  const isOpen = expandable && open;

  const Wrapper = expandable ? "button" : "div";

  return (
    <li className="relative flex gap-3 pb-5">
      <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" aria-hidden />
      <span className={cn("relative z-10 mt-1 size-2.5 shrink-0 rounded-full", toneClass.replace("text-", "bg-"))} />
      <div className="min-w-0 flex-1">
        <Wrapper
          {...(expandable
            ? {
                type: "button" as const,
                onClick: () => setOpen((v) => !v),
                "aria-expanded": isOpen,
              }
            : {})}
          className={cn(
            "block w-full text-left",
            expandable &&
              "-mx-2 -my-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {/* Date + attachment/note indicators + a chevron when the row expands. */}
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{formatDate(entry.recordedAt.slice(0, 10))}</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {files.length > 0 ? (
                <Chip icon={<Paperclip className="size-3" aria-hidden />} label={`${files.length} file${files.length === 1 ? "" : "s"}`} />
              ) : null}
              {links.length > 0 ? (
                <Chip icon={<Link2 className="size-3" aria-hidden />} label={`${links.length} link${links.length === 1 ? "" : "s"}`} />
              ) : null}
              {/* Note chip only where the note is not already revealed — avoids restating it beside the open card. */}
              {entry.contextNote && !isOpen ? <Chip icon={<FileText className="size-3" aria-hidden />} label="Note" /> : null}
              {expandable ? (
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
              ) : null}
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

          {/* A one-line note preview when collapsed; the full note moves into the card once open. */}
          {entry.contextNote && !isOpen ? (
            <p className="mt-1.5 line-clamp-1 text-sm leading-relaxed text-muted-foreground">{entry.contextNote}</p>
          ) : null}
        </Wrapper>

        {isOpen ? <ExpandedDetail note={entry.contextNote} evidence={openable} onOpenFile={onOpenFile} openingFileId={openingFileId} /> : null}
      </div>
    </li>
  );
}

/** The revealed body of an update: its full note, then each attached file and link with an Open action. */
function ExpandedDetail({
  note,
  evidence,
  onOpenFile,
  openingFileId,
}: {
  note: string | null;
  evidence: EvidenceDto[];
  onOpenFile: (evidenceId: string) => void;
  openingFileId: string | null;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/25 p-3.5">
      {note ? (
        <div className="flex gap-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Note</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note}</p>
          </div>
        </div>
      ) : null}

      {evidence.length > 0 ? (
        <div className={cn(note && "border-t border-border/70 pt-3")}>
          <p className="type-eyebrow text-muted-foreground">Evidence ({evidence.length})</p>
          <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-card">
            {evidence.map((item) => (
              <EvidenceRow key={item.id} item={item} onOpenFile={onOpenFile} opening={openingFileId === item.id} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** One evidence item: a file by filename and size, or a link by label and hostname, with an Open action. */
function EvidenceRow({
  item,
  onOpenFile,
  opening,
}: {
  item: EvidenceDto;
  onOpenFile: (evidenceId: string) => void;
  opening: boolean;
}) {
  const isFile = item.kind === "File";
  const host = !isFile && item.url ? hostname(item.url) : null;
  const meta = isFile ? formatBytes(item.sizeBytes) : linkPath(item.url);
  const primary = isFile ? item.fileName ?? "Attachment" : host || item.url || "Link";
  // A file downloads only where the server exposed the action (named-detail authorization); a link is its URL.
  const canOpenFile = isFile && Boolean(item.downloadPath);
  const linkHref = !isFile ? item.url : null;

  const openClasses =
    "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          isFile ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        {isFile ? <FileText className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{primary}</p>
        {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      {canOpenFile ? (
        <button type="button" onClick={() => onOpenFile(item.id)} disabled={opening} className={openClasses}>
          {opening ? "Opening" : "Open"}
          {opening ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="size-3.5" aria-hidden />
          )}
        </button>
      ) : linkHref ? (
        <a href={linkHref} target="_blank" rel="noreferrer noopener" className={openClasses}>
          Open <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
    </li>
  );
}

/** A quiet indicator pill for a note, file, or link attached to a progress update. */
function Chip({ icon, label }: { icon: ReactNode; label: string }) {
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

/** Human-readable byte size (KB/MB), or null when unknown. */
function formatBytes(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The bare hostname of a link, for a compact readable label; falls back to the raw value. */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The path + query of a link, as the secondary line under its hostname; null when there is nothing beyond the host. */
function linkPath(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const rest = `${u.pathname}${u.search}`.replace(/\/$/, "");
    return rest && rest !== "/" ? rest : null;
  } catch {
    return null;
  }
}
