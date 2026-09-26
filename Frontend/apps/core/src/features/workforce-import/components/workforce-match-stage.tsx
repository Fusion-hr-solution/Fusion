"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@repo/ds/shell";
import { translateWorkforceImportError, type WorkforceImportMatch, type WorkforceMatchUpdateRequest } from "@repo/api";
import { ImportMatchAssistance } from "@/features/data-import/components/match-assistance";
import { ImportMatchBanner, matchHeadline } from "@/features/data-import/components/match-banner";
import { ImportMatchChecklist } from "@/features/data-import/components/match-checklist";
import { ImportFilePreview } from "@/features/data-import/components/match-file-preview";
import { ImportMatchFooter } from "@/features/data-import/components/match-footer";
import { ImportMatchNextSteps } from "@/features/data-import/components/match-next-steps";
import { useMatchEdit } from "@/features/data-import/components/match-table";
import { downloadBlob } from "@/features/organization-import/model/format";
import { useWorkforceImportApi, useWorkforceSessionCache } from "../api/use-workforce-import";
import { workforceImportStageHref } from "../model/import-stage";
import { deriveInterpretation, deriveLifecycleRows, previewColumns, previewRows, summarizeWorkforceMatch } from "../model/match-view";
import { useWorkforceImportFrame } from "./workforce-import-frame";
import { WorkforceColumnMapping, WorkforceInterpretationPanel, WorkforceStatusMeaning } from "./workforce-match-sections";

/**
 * Match: what does this workforce source mean? Organization's Match grammar with the workforce's
 * own concepts. Every answer goes to the server and comes back as the attempt's new truth;
 * readiness alone decides when Review is reachable.
 */
export function WorkforceMatchStage() {
  const { session } = useWorkforceImportFrame();
  const api = useWorkforceImportApi();
  const cache = useWorkforceSessionCache();
  const [running, setRunning] = useState(false);
  const edits = useMatchEdit<WorkforceMatchUpdateRequest>(
    async (change) => cache(await api.updateMatch(session.id, session.version, change)),
    (error) => translateWorkforceImportError(error).message
  );
  const match = session.match;
  if (!match) return null;

  async function runAssistance(grantTenantConsent: boolean) {
    const inputFingerprint = match?.semanticAssistance?.inputFingerprint;
    if (!inputFingerprint) return;
    setRunning(true);
    try {
      await cache(await api.runSemanticAssistance(session.id, inputFingerprint, grantTenantConsent));
    } catch (error) {
      toast.error("Automatic matching didn't run", { description: translateWorkforceImportError(error).message });
    } finally {
      setRunning(false);
    }
  }

  async function downloadTemplate() {
    try {
      downloadBlob(await api.downloadTemplate(), "Fusion-workforce-template.xlsx");
    } catch (error) {
      toast.error("Template could not be downloaded", { description: translateWorkforceImportError(error).message });
    }
  }

  const summary = summarizeWorkforceMatch(match);
  const rowCount = session.source.rowCount ?? match.previewRows.length;

  return (
    <section aria-label="Match">
      <PageContainer className="space-y-6 pt-2">
        <ImportMatchBanner
          headline={matchHeadline({
            needsReview: summary.needsReview,
            mostlyUnresolved: summary.mostlyUnresolved,
            byAi: (match.semanticAssistance?.appliedCount ?? 0) > 0,
            noun: "workforce data",
          })}
          assistance={match.semanticAssistance}
          needsReview={summary.needsReview}
          facts={[
            { value: String(summary.columnsTotal), label: "Source columns reviewed" },
            { value: String(rowCount), label: rowCount === 1 ? "Employee detected" : "Employees detected" },
            { value: String(summary.needsReview), label: "Needs review", emphasis: summary.needsReview > 0 },
          ]}
        >
          <ImportMatchAssistance
            assistance={match.semanticAssistance}
            needsReview={summary.needsReview}
            running={running}
            onRun={(grant) => void runAssistance(grant)}
          />
        </ImportMatchBanner>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
          <div className="min-w-0 space-y-6">
            <WorkforceColumnMapping match={match} edits={edits} locked={running} />
            <WorkforceStatusMeaning match={match} edits={edits} locked={running} />
            <WorkforceInterpretationPanel match={match} edits={edits} locked={running} />
          </div>
          <aside className="min-w-0 space-y-6">
            <WorkforceFilePreview match={match} />
            <WorkforceMatchChecklist match={match} rowCount={rowCount} />
            <ImportMatchNextSteps remaining={summary.needsReview} onDownloadTemplate={() => void downloadTemplate()} />
          </aside>
        </div>
      </PageContainer>
      <ImportMatchFooter
        uploadHref="/people/import"
        reviewHref={workforceImportStageHref(session.id, "review")}
        remaining={summary.needsReview}
        canContinue={match.readiness.canContinue && !running && !edits.busy}
      />
    </section>
  );
}

function WorkforceFilePreview({ match }: { match: WorkforceImportMatch }) {
  const columns = previewColumns(match).map((c, index) => ({ key: c.key, label: c.label, nowrap: true, strong: index === 0 }));
  const buildRows = useCallback((limit: number) => previewRows(match, limit), [match]);
  if (columns.length === 0) return null;
  return <ImportFilePreview columns={columns} totalRows={match.previewRows.length} buildRows={buildRows} initialLimit={10} />;
}

function WorkforceMatchChecklist({ match, rowCount }: { match: WorkforceImportMatch; rowCount: number }) {
  const summary = summarizeWorkforceMatch(match);
  const kinds = new Set(match.readiness.requiredDecisions.map((d) => d.kind));
  const concepts = new Map(deriveInterpretation(match).map((item) => [item.key, item]));
  const statuses = deriveLifecycleRows(match);
  const open = statuses.filter((s) => s.status === "needs-review").length;
  const concept = (key: "identity" | "organization" | "manager", label: string) => {
    const item = concepts.get(key)!;
    return { label, value: item.state === "needs-review" ? "Needs review" : item.state === "optional" ? "Optional" : "Understood", done: item.state !== "needs-review" };
  };
  return (
    <ImportMatchChecklist
      lines={[
        {
          label: "Source columns mapped",
          value: `${summary.columnsMapped} of ${summary.columnsTotal} mapped`,
          done: !kinds.has("FieldMapping") && !kinds.has("MappingConflict"),
        },
        { label: "Employees detected", value: String(rowCount), done: rowCount > 0 },
        concept("identity", "Employee identity"),
        concept("organization", "Organization links"),
        concept("manager", "Reporting lines"),
        ...(statuses.length
          ? [{ label: "Employment statuses", value: open ? `${open} to confirm` : `${statuses.length} understood`, done: open === 0 }]
          : []),
      ]}
    />
  );
}
