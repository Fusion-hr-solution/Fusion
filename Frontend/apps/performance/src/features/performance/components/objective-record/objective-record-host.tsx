"use client";

import { useMemo, useState } from "react";
import { classifyApiError } from "@repo/api";
import { SheetTitle } from "@repo/ds/components/ui/sheet";
import { useCurrentCycle, useCycle, useGoal, usePerformanceAccess } from "../../api/use-performance";
import { CompanyComposerHost } from "../goals/company-composer-host";
import { OrgComposerHost } from "../goals/org-composer-host";
import type { ObjectiveRef } from "./objective-ref";
import { toObjectiveRecord, type ObjectiveRecord, type RecordSectionId } from "./objective-record-model";
import { ObjectiveRecordSheet, type RecordSheetState } from "./objective-record-sheet";
import { RecordActions } from "./record-actions";
import { RecordProgressMode } from "./modes/record-progress";
import { AlignedChildrenSection } from "./sections/aligned-children-section";
import { AlignmentSection } from "./sections/alignment-section";
import { ContributionSection } from "./sections/contribution-section";
import { DescriptionSection } from "./sections/description-section";
import { MeasurementSection } from "./sections/measurement-section";
import { ProgressSection } from "./sections/progress-section";
import { ObjectiveSummary } from "./sections/summary-section";
import { PlanWeightSection, TimelineSection } from "./sections/window-sections";
import { useObjectiveRecord } from "./use-objective-record";

/**
 * The one objective record, mounted once for the whole Performance workspace. Any surface opens it by
 * putting an objective reference in the URL; the host reads that reference — cycle and objective — and
 * fetches the canonical detail for exactly that Cycle, never "the current" one. It owns the record's
 * task mode and the composers its Edit action opens, so no surface carries its own detail experience.
 */
export function ObjectiveRecordHost() {
  const { openRef, mode, open, close } = useObjectiveRecord();

  // Keep the last reference while the sheet animates closed, so content doesn't flash to loading.
  const [shownRef, setShownRef] = useState<ObjectiveRef | null>(openRef);
  if (openRef && (openRef.cycleId !== shownRef?.cycleId || openRef.objectiveId !== shownRef?.objectiveId)) {
    setShownRef(openRef);
  }

  const detail = useGoal(shownRef?.cycleId ?? null, shownRef?.objectiveId ?? null);
  const cycle = useCycle(shownRef?.cycleId ?? null);
  const current = useCurrentCycle();
  const access = usePerformanceAccess();
  const [editing, setEditing] = useState<{ kind: ObjectiveRecord["kind"]; objectiveId: string } | null>(null);

  // Only trust data that belongs to the reference being shown — a query keeping its previous result while
  // the next one loads must not paint the old objective into the new record.
  const matches = detail.data?.node.id === shownRef?.objectiveId && detail.data?.cycleId === shownRef?.cycleId;
  const record = useMemo(() => (matches && detail.data ? toObjectiveRecord(detail.data) : null), [matches, detail.data]);

  const state: RecordSheetState = record
    ? { status: "ready", record }
    : detail.error
      ? ["auth", "validation"].includes(classifyApiError(detail.error))
        ? { status: "denied" }
        : { status: "error", onRetry: () => void detail.refetch() }
      : { status: "loading" };

  // Organization direction is a workspace for the current Cycle; a record from another Cycle reads in place.
  const canOpenDirection =
    (access.data?.canViewOrgDirection ?? false) && shownRef?.cycleId === current.data?.cycle.id;
  const recording = mode === "record" && record?.can.updateProgress;

  return (
    <>
      <ObjectiveRecordSheet
        open={openRef !== null}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        state={state}
        header={(r) => <ObjectiveSummary record={r} titleAs={SheetTitle} />}
        renderSection={(id, r, options) => renderSection(id, r, options, open, () => open(r.ref, { mode: "record" }))}
        actions={(r) => (
          <RecordActions
            record={r}
            canOpenDirection={canOpenDirection}
            onEdit={() => setEditing({ kind: r.kind, objectiveId: r.ref.objectiveId })}
            onRemoved={close}
          />
        )}
        task={recording && record ? <RecordProgressMode record={record} onDone={() => open(record.ref)} /> : undefined}
      />

      {editing && cycle.data ? (
        editing.kind === "company" ? (
          <CompanyComposerHost
            cycle={cycle.data.cycle}
            state={{ mode: "edit", objectiveId: editing.objectiveId }}
            onClose={() => setEditing(null)}
          />
        ) : (
          <OrgComposerHost
            cycle={cycle.data.cycle}
            state={{ mode: "edit", objectiveId: editing.objectiveId }}
            ownUnit={null}
            onClose={() => setEditing(null)}
          />
        )
      ) : null}
    </>
  );
}

function renderSection(
  id: RecordSectionId,
  record: ObjectiveRecord,
  options: { paired: boolean },
  open: (ref: ObjectiveRef) => void,
  startRecording: () => void
) {
  switch (id) {
    case "description":
      return <DescriptionSection record={record} />;
    case "alignment":
      return <AlignmentSection record={record} onOpen={open} />;
    case "measurement":
      return <MeasurementSection measurement={record.measurement} progressSource={record.progressSource} />;
    case "timeline":
      return <TimelineSection record={record} compact={options.paired} />;
    case "plan-weight":
      return <PlanWeightSection record={record} />;
    case "progress":
      return <ProgressSection record={record} onRecord={record.can.updateProgress ? startRecording : undefined} />;
    case "aligned-children":
      return <AlignedChildrenSection record={record} onOpen={open} />;
    case "contribution":
      return <ContributionSection record={record} />;
  }
}
