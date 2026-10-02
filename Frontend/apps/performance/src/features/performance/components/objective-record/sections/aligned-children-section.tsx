import { ChevronRight } from "@/lib/icons";
import { StatusBadge } from "@repo/ds/shell";
import { STATE_LABEL, STATE_TONE } from "../../goals/goals-lib";
import { pct } from "../../plan/plan-lib";
import type { ObjectiveRef } from "../objective-ref";
import { directionScopeLabel, type ObjectiveRecord } from "../objective-record-model";
import { RecordSection } from "./record-primitives";

/** The direction objectives aligned beneath this one — each opens in the same record. */
export function AlignedChildrenSection({
  record,
  onOpen,
}: {
  record: ObjectiveRecord;
  onOpen: (ref: ObjectiveRef) => void;
}) {
  if (record.children.length === 0) return null;
  return (
    <RecordSection label={`Aligned objectives · ${record.children.length}`}>
      <ul className="divide-y divide-border overflow-hidden rounded-surface border border-border bg-popover dark:bg-card">
        {record.children.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              onClick={() => onOpen({ cycleId: record.ref.cycleId, objectiveId: child.id })}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--type-tint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{child.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {directionScopeLabel(child)} · {child.accountablePersonName ?? "Unassigned"}
                </span>
              </span>
              {child.state === "Published" ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {child.hasProgress ? `${pct(Math.round(child.derivedProgress))}%` : "—"}
                </span>
              ) : (
                <StatusBadge tone={STATE_TONE[child.state]}>{STATE_LABEL[child.state]}</StatusBadge>
              )}
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </RecordSection>
  );
}
