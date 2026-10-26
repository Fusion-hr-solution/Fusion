import type { ObjectiveStatus } from "@repo/api";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import { usePerformanceWords } from "./use-words";

const TONE: Record<ObjectiveStatus, StatusTone> = {
  OnTrack: "success",
  AtRisk: "warning",
  OffTrack: "danger",
};

/** The owner's reported status (D-05). Nothing renders before the first report: unreported is never "on track". */
export function ObjectiveStatusBadge({ status, className }: { status: ObjectiveStatus | null; className?: string }) {
  const words = usePerformanceWords();
  if (!status) return null;
  return (
    <StatusBadge tone={TONE[status]} dot className={className}>
      {words.objectiveStatus(status)}
    </StatusBadge>
  );
}

export interface StatusMix {
  onTrack: number;
  atRisk: number;
  offTrack: number;
  notReported: number;
}

export function statusMix(statuses: ReadonlyArray<ObjectiveStatus | null>): StatusMix {
  return {
    onTrack: statuses.filter((s) => s === "OnTrack").length,
    atRisk: statuses.filter((s) => s === "AtRisk").length,
    offTrack: statuses.filter((s) => s === "OffTrack").length,
    notReported: statuses.filter((s) => s === null).length,
  };
}

