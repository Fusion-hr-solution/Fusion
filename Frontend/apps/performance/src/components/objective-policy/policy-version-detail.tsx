"use client";

import type { PolicyVersionDto } from "@repo/api";
import {
  parseWeightValues,
  labelMeasurementTypes,
  labelCascadeMode,
  formatDate,
} from "@/lib/labels";

interface PolicyVersionDetailProps {
  version: PolicyVersionDto;
  compact?: boolean;
}

export function PolicyVersionDetail({ version, compact }: PolicyVersionDetailProps) {
  const weights = parseWeightValues(version.allowedWeightValues);

  const rows: [string, React.ReactNode][] = [
    ["Maximum objectives per plan", version.maxObjectivesPerPlan],
    [
      "Allowed objective weights",
      <span key="weights" className="flex flex-wrap gap-1">
        {weights.map((w) => (
          <span
            key={w}
            className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-medium"
          >
            {w}%
          </span>
        ))}
      </span>,
    ],
    ["Manager review time", `${version.managerValidationSlaDays} days`],
    ["How objectives are measured", labelMeasurementTypes(version.measurementTypes)],
    ["Strategic alignment", labelCascadeMode(version.cascadeMode)],
    ["Supporting files", version.attachmentsEnabled ? "Allowed" : "Not allowed"],
  ];

  if (!compact) {
    if (version.activatedAt) rows.push(["Published", formatDate(version.activatedAt)]);
    if (version.activatedByName && version.activatedByName !== "Migration")
      rows.push(["Published by", version.activatedByName]);
    if (version.changeSummary)
      rows.push(["Change note", version.changeSummary]);
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
      {rows.map(([label, value]) => (
        <>
          <dt key={`dt-${label}`} className="text-muted-foreground whitespace-nowrap">{label}</dt>
          <dd key={`dd-${label}`}>{value}</dd>
        </>
      ))}
    </dl>
  );
}
