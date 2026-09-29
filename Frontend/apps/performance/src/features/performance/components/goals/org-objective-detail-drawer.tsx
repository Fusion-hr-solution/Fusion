"use client";

import { useMemo, useState } from "react";
import type { GoalDetailDto, ObjectiveProgressDto, PlanObjectiveDto } from "@repo/api";
import { ObjectiveDetailDrawer } from "../plan/objective-detail-drawer";
import { useGoal, useObjectiveProgress } from "../../api/use-performance";

/**
 * The organizational-objective reader — a strategic or organizational objective shown in the *same*
 * objective drawer plan objectives use, so an objective reads identically wherever it is opened. It
 * fetches the canonical objective detail and its progress, adapts them to the drawer's objective shape
 * (no plan weight, read-only progress), and hands off to the shared drawer in its organizational variant.
 * Editing/publishing/contribution stay in Organization Goals; this surface is for reading.
 */
export function OrgObjectiveDetailDrawer({
  cycleId,
  objectiveId,
  open,
  onOpenChange,
}: {
  cycleId: string;
  objectiveId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Hold the last objective shown so closing (which clears the caller's id) keeps the content in place
  // through the exit animation instead of flashing back to the loading state.
  const [shownId, setShownId] = useState(objectiveId);
  if (objectiveId && objectiveId !== shownId) setShownId(objectiveId);

  const detail = useGoal(cycleId, shownId);
  const progress = useObjectiveProgress(cycleId, shownId);

  // Only trust data that belongs to the objective being shown — a query keeping the previous result
  // while the next one loads must not paint the old objective into the new drawer.
  const current = detail.data?.node.id === shownId ? detail.data : undefined;
  const currentProgress =
    progress.data?.objectiveId === shownId ? progress.data : null;

  const objective = useMemo(
    () => (current ? toObjectiveView(current, currentProgress) : null),
    [current, currentProgress]
  );

  const node = current?.node;
  const kindLabel = node
    ? node.ownershipScope === "Company"
      ? "Company strategic objective"
      : `${node.orgUnitName ?? "Organizational"} objective`
    : undefined;

  const parent = current?.parent ?? null;
  const alignmentScope = parent
    ? parent.ownershipScope === "Company"
      ? "Company strategy"
      : parent.orgUnitName ?? undefined
    : undefined;

  return (
    <ObjectiveDetailDrawer
      objective={objective}
      index={0}
      variant="organizational"
      kindLabel={kindLabel}
      alignmentScope={alignmentScope}
      cycleId={cycleId}
      open={open}
      onOpenChange={onOpenChange}
      error={detail.error ? { onRetry: () => void detail.refetch() } : undefined}
    />
  );
}

/** Adapt the canonical objective detail + progress into the shared drawer's objective shape. */
function toObjectiveView(detail: GoalDetailDto, progress: ObjectiveProgressDto | null): PlanObjectiveDto {
  const n = detail.node;
  return {
    id: n.id,
    title: n.title,
    description: detail.description,
    parentObjectiveId: n.parentObjectiveId,
    // One upstream level is enough for the drawer's "supports {parent}" line.
    directionPath: detail.parent ? [detail.parent.title] : [],
    isAligned: n.parentObjectiveId != null,
    startDate: n.startDate,
    endDate: n.endDate,
    progressSource: n.progressSource,
    measurementSummary: n.measurementSummary,
    measurement: detail.measurement,
    // An organizational objective carries no plan weight; the drawer's organizational variant hides it.
    planWeight: null,
    hasProgress: progress?.hasProgress ?? false,
    derivedProgress: progress?.derivedProgress ?? 0,
    currentPercentage: progress?.currentPercentage ?? null,
    currentActual: progress?.currentActual ?? null,
    lastProgressAt: progress?.history[0]?.recordedAt ?? null,
    // Recording is not offered from this reader; progress shows read-only.
    canUpdateProgress: false,
  };
}
