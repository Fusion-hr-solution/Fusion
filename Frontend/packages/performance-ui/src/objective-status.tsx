import type { ObjectiveStatus } from "@repo/api";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";

export const OBJECTIVE_STATUS_LABEL: Record<ObjectiveStatus, string> = {
  OnTrack: "On track",
  AtRisk: "At risk",
  OffTrack: "Off track",
};

const TONE: Record<ObjectiveStatus, StatusTone> = {
  OnTrack: "success",
  AtRisk: "warning",
  OffTrack: "danger",
};

/** The owner's reported status (D-05). Nothing renders before the first report: unreported is never "on track". */
export function ObjectiveStatusBadge({ status, className }: { status: ObjectiveStatus | null; className?: string }) {
  if (!status) return null;
  return (
    <StatusBadge tone={TONE[status]} dot className={className}>
      {OBJECTIVE_STATUS_LABEL[status]}
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

/** "2 on track · 1 at risk · 1 not reported", leaving out what is zero. */
export function describeStatusMix(mix: StatusMix): string {
  return [
    [mix.onTrack, "on track"],
    [mix.atRisk, "at risk"],
    [mix.offTrack, "off track"],
    [mix.notReported, "not reported"],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" · ");
}
