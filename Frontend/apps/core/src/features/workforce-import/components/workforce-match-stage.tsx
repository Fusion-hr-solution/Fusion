"use client";

import { useSay } from "@repo/ds/lib/say";
import { useImportProblem } from "@/features/data-import/components/import-words";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@repo/ds/shell";
import { translateWorkforceImportError, type WorkforceImportMatch, type WorkforceMatchUpdateRequest } from "@repo/api";
import { ImportMatchAssistance } from "@/features/data-import/components/match-assistance";
import { ImportMatchBanner, MatchHeadline } from "@/features/data-import/components/match-banner";
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
  const t = useTranslations("wfImport");
  const problemLine = useImportProblem();
  const { session } = useWorkforceImportFrame();
  const api = useWorkforceImportApi();
  const cache = useWorkforceSessionCache();
  const [running, setRunning] = useState(false);
  const edits = useMatchEdit<WorkforceMatchUpdateRequest>(
    async (change) => cache(await api.updateMatch(session.id, session.version, change)),
    (error) => problemLine(translateWorkforceImportError(error))
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
      toast.error(t("match.assistanceFailed"), { description: problemLine(translateWorkforceImportError(error)) });
    } finally {
      setRunning(false);
    }
  }

  async function downloadTemplate() {
    try {
      downloadBlob(await api.downloadTemplate(), "Fusion-workforce-template.xlsx");
    } catch (error) {
      toast.error(t("entry.templateFailed"), { description: problemLine(translateWorkforceImportError(error)) });
    }
  }

  const summary = summarizeWorkforceMatch(match);
  const rowCount = session.source.rowCount ?? match.previewRows.length;

  return (
    <section aria-label={t("match.label")}>
      <PageContainer className="space-y-6 pt-2">
        <ImportMatchBanner
          headline={
            <MatchHeadline
              needsReview={summary.needsReview}
              mostlyUnresolved={summary.mostlyUnresolved}
              byAi={(match.semanticAssistance?.appliedCount ?? 0) > 0}
              noun="workforce"
            />
          }
          assistance={match.semanticAssistance}
          needsReview={summary.needsReview}
          facts={[
            { value: String(summary.columnsTotal), label: t("match.columnsReviewed") },
            { value: String(rowCount), label: t("match.detected", { count: rowCount }) },
            { value: String(summary.needsReview), label: t("match.needsReview"), emphasis: summary.needsReview > 0 },
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
  const say = useSay("wfImport");
  const columns = previewColumns(match, 5, say).map((c, index) => ({ key: c.key, label: c.label, nowrap: true, strong: index === 0 }));
  const buildRows = useCallback((limit: number) => previewRows(match, limit), [match]);
  if (columns.length === 0) return null;
  return <ImportFilePreview columns={columns} totalRows={match.previewRows.length} buildRows={buildRows} initialLimit={10} />;
}

function WorkforceMatchChecklist({ match, rowCount }: { match: WorkforceImportMatch; rowCount: number }) {
  const summary = summarizeWorkforceMatch(match);
  const kinds = new Set(match.readiness.requiredDecisions.map((d) => d.kind));
  const t = useTranslations("wfImport.match.checklist");
  const say = useSay("wfImport");
  const concepts = new Map(deriveInterpretation(match, say).map((item) => [item.key, item]));
  const statuses = deriveLifecycleRows(match);
  const open = statuses.filter((s) => s.status === "needs-review").length;
  const concept = (key: "identity" | "organization" | "manager", label: string) => {
    const item = concepts.get(key)!;
    return {
      label,
      value: item.state === "needs-review" ? t("needsReview") : item.state === "optional" ? t("optional") : t("understood"),
      done: item.state !== "needs-review",
    };
  };
  return (
    <ImportMatchChecklist
      lines={[
        {
          label: t("columns"),
          value: t("columnsValue", { mapped: summary.columnsMapped, total: summary.columnsTotal }),
          done: !kinds.has("FieldMapping") && !kinds.has("MappingConflict"),
        },
        { label: t("detected"), value: String(rowCount), done: rowCount > 0 },
        concept("identity", t("identity")),
        concept("organization", t("organization")),
        concept("manager", t("manager")),
        ...(statuses.length
          ? [
              {
                label: t("statuses"),
                value: open ? t("toConfirm", { count: open }) : t("understoodCount", { count: statuses.length }),
                done: open === 0,
              },
            ]
          : []),
      ]}
    />
  );
}
