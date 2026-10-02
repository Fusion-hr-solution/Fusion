"use client";

import Link from "next/link";
import { toast } from "sonner";
import { GitBranch, Pencil, Trash2 } from "@/lib/icons";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton } from "@repo/ds/shell";
import { useGoalMutations, useSaveStrategy } from "../../api/use-performance";
import type { ObjectiveRecord } from "./objective-record-model";

/**
 * The record's actions, each offered only when the server says this viewer may take it. Company direction
 * is maintained through strategy, team objectives through goals — the record routes each to its own
 * transport so the same buttons mean the same thing on every objective.
 */
export function RecordActions({
  record,
  canOpenDirection,
  onEdit,
  onRemoved,
}: {
  record: ObjectiveRecord;
  /** The viewer can enter the organization-direction workspace (navigation, not readability). */
  canOpenDirection: boolean;
  onEdit: () => void;
  onRemoved: () => void;
}) {
  const goals = useGoalMutations(record.ref.cycleId);
  const strategy = useSaveStrategy(record.ref.cycleId);
  const isCompany = record.kind === "company";
  const publish = isCompany ? strategy.publish : goals.publish;
  const remove = isCompany ? strategy.remove : goals.remove;
  const showDirectionLink = canOpenDirection && record.kind !== "plan";

  if (!record.can.edit && !record.can.remove && !record.can.publish && !showDirectionLink) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-inlay px-5 py-3.5 dark:bg-popover">
      <div className="flex items-center gap-1.5">
        {record.can.edit ? (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" data-icon="inline-start" /> Edit
          </Button>
        ) : null}
        {record.can.remove ? (
          <AsyncButton
            variant="ghost"
            size="sm"
            pending={remove.isLoading}
            onClick={async () => {
              try {
                await remove.mutateAsync(record.ref.objectiveId);
                toast.success("Draft objective removed.");
                onRemoved();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "The objective could not be removed.");
              }
            }}
          >
            <Trash2 className="size-3.5" data-icon="inline-start" /> Remove
          </AsyncButton>
        ) : null}
        {showDirectionLink ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/goals?focus=${record.ref.objectiveId}`}>
              <GitBranch className="size-3.5" data-icon="inline-start" /> Open in organization direction
            </Link>
          </Button>
        ) : null}
      </div>
      {record.can.publish ? (
        <AsyncButton
          size="sm"
          pending={publish.isLoading}
          onClick={async () => {
            try {
              await publish.mutateAsync(record.ref.objectiveId);
              toast.success(isCompany ? "Published as company direction." : "Published as organizational direction.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The objective could not be published.");
            }
          }}
        >
          Publish
        </AsyncButton>
      ) : null}
    </div>
  );
}
