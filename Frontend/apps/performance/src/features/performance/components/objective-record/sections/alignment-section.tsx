import { ChevronRight } from "@/lib/icons";
import { ScopeMark } from "../../scope-mark";
import type { ObjectiveRef } from "../objective-ref";
import type { ObjectiveRecord } from "../objective-record-model";
import { RecordSection } from "./record-primitives";

/**
 * The direction this objective supports. The parent opens in the same record, so walking up the
 * cascade is the same gesture everywhere — and reading a published parent never requires entering the
 * organization-direction workspace.
 */
export function AlignmentSection({
  record,
  onOpen,
}: {
  record: ObjectiveRecord;
  onOpen: (ref: ObjectiveRef) => void;
}) {
  const parent = record.parent;
  if (!parent) return null;
  return (
    <RecordSection label="Supports">
      <button
        type="button"
        onClick={() => onOpen(parent.ref)}
        className="group flex w-full items-center gap-3 rounded-surface border border-border bg-popover p-4 text-left transition-colors hover:border-(--type-ring) hover:bg-(--type-tint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-(--type-tint) text-(--type-ink) ring-1 ring-(--type-ring)">
          <ScopeMark className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium tracking-tight text-foreground">{parent.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{parent.scopeLabel}{parent.archived ? " · Archived" : ""}</span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </button>
    </RecordSection>
  );
}
