"use client";

import { Download, ExternalLink, FileText, Type } from "lucide-react";
import type { ProgressUpdateDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { PROGRESS_EVENT_LABEL, num, pct } from "./progress-lib";
import { initials } from "../plan/plan-lib";

/**
 * The attributable progress timeline — who recorded what, when, the value change, the context, and
 * any evidence, read as business events rather than raw audit payloads. A file's download action
 * appears only when the read model provided an authorized path.
 */
export function ProgressHistory({
  history,
  downloadHref,
}: {
  history: ProgressUpdateDto[];
  downloadHref: (path: string) => string;
}) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No progress recorded yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {history.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
          {/* Rail */}
          {index < history.length - 1 ? <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden /> : null}
          <Avatar className="mt-0.5 size-8 shrink-0">
            <AvatarFallback className="text-[10px]">{initials(entry.author.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{entry.author.name ?? "Owner"}</span>
              <span className="text-muted-foreground">{eventSummary(entry)}</span>
              {entry.isCorrection ? (
                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">Correction</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{new Date(entry.recordedAt).toLocaleString()}</p>

            {entry.contextNote ? <p className="mt-1.5 rounded-lg bg-muted/40 px-3 py-2 text-sm">{entry.contextNote}</p> : null}

            {entry.evidence.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {entry.evidence.map((item) => (
                  <li key={item.id}>
                    {item.kind === "File" && item.downloadPath ? (
                      <a
                        href={downloadHref(item.downloadPath)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted/50"
                      >
                        <FileText className="size-3.5" aria-hidden /> {item.fileName} <Download className="size-3 opacity-60" aria-hidden />
                      </a>
                    ) : item.kind === "File" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs text-muted-foreground">
                        <FileText className="size-3.5" aria-hidden /> {item.fileName}
                      </span>
                    ) : item.kind === "Link" ? (
                      <a
                        href={item.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted/50"
                      >
                        <ExternalLink className="size-3.5" aria-hidden /> {item.referenceText || item.url}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs">
                        <Type className="size-3.5" aria-hidden /> {item.referenceText}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function eventSummary(entry: ProgressUpdateDto): string {
  switch (entry.kind) {
    case "PercentageSet":
      return `set completion to ${pct(entry.value)}%`;
    case "NumericActual":
      return `recorded ${num(entry.value)}`;
    case "MilestoneCompleted":
      return `completed ${entry.milestoneTitle ?? "a milestone"}`;
    case "MilestoneReopened":
      return `reopened ${entry.milestoneTitle ?? "a milestone"}`;
    default:
      return PROGRESS_EVENT_LABEL[entry.kind];
  }
}
