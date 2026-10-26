"use client";

import { useTranslations } from "next-intl";
import { useSay } from "@repo/ds/lib/say";
import { useImportProblem } from "@/features/data-import/components/import-words";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageContainer } from "@repo/ds/shell";
import { translateOrganizationImportError, type OrganizationImportMatch, type OrganizationSourceTable } from "@repo/api";
import { ImportMatchAssistance } from "@/features/data-import/components/match-assistance";
import { ImportMatchBanner, MatchHeadline } from "@/features/data-import/components/match-banner";
import { ImportMatchChecklist } from "@/features/data-import/components/match-checklist";
import { ImportFilePreview, PreviewUnmatched } from "@/features/data-import/components/match-file-preview";
import { ImportMatchFooter } from "@/features/data-import/components/match-footer";
import { ImportMatchNextSteps } from "@/features/data-import/components/match-next-steps";
import { useOrganizationImportApi, useOrganizationImportMutations } from "../api/use-organization-import";
import { downloadBlob } from "../model/format";
import { importStageHref } from "../model/import-stage";
import { buildMatchPreview } from "../model/match-preview";
import { countMappedColumns } from "../model/match-progress";
import { summarizeMatch } from "../model/match-summary";
import { useImportFrame } from "./import-frame";
import { MatchColumnMapping } from "./match-column-mapping";
import { MatchTypeMeaning } from "./match-type-meaning";

/** Match: resolving what the file's columns and terms mean for Organization. */
export function MatchStage() {
  const t = useTranslations("orgImport");
  const say = useSay("orgImport");
  const problemLine = useImportProblem();
  const { session } = useImportFrame();
  const api = useOrganizationImportApi();
  const { runSemanticAssistance } = useOrganizationImportMutations();
  const match = session.match;
  const table = session.source.table;
  const running = runSemanticAssistance.isLoading;

  async function runAssistance(grantTenantConsent: boolean) {
    const inputFingerprint = match?.semanticAssistance?.inputFingerprint;
    if (!inputFingerprint) return;
    try {
      await runSemanticAssistance.mutateAsync({ id: session.id, inputFingerprint, grantTenantConsent });
    } catch (error) {
      toast.error(t("match.assistanceFailed"), {
        description: problemLine(translateOrganizationImportError(error)),
      });
    }
  }

  async function downloadTemplate() {
    try {
      downloadBlob(await api.downloadTemplate(), "Fusion-organization-template.xlsx");
    } catch (error) {
      toast.error(t("upload.templateFailed"), {
        description: problemLine(translateOrganizationImportError(error)),
      });
    }
  }

  const summary = match ? summarizeMatch(match, say) : null;
  const remaining = match?.readiness.requiredDecisions.length ?? 0;

  return (
    <section aria-label={t("match.label")}>
      <PageContainer className="space-y-6 pt-2">
        {match && summary ? (
          <ImportMatchBanner
            headline={
              <MatchHeadline
                needsReview={summary.needsReview}
                mostlyUnresolved={!summary.shapeResolved || summary.typesResolved * 2 < summary.typesTotal}
                byAi={(match.semanticAssistance?.appliedCount ?? 0) > 0}
              />
            }
            assistance={match.semanticAssistance}
            needsReview={summary.needsReview}
            facts={[
              { value: summary.shapeLabel, label: t("match.hierarchy") },
              {
                value: summary.typesTotal ? `${summary.typesResolved}/${summary.typesTotal}` : "0",
                label: t("match.typesResolved"),
              },
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
        ) : null}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
          <div className="min-w-0 space-y-6">
            {match && table ? (
              <>
                <MatchColumnMapping table={table} match={match} locked={running} />
                <MatchTypeMeaning match={match} locked={running} />
              </>
            ) : null}
          </div>
          <aside className="min-w-0 space-y-6">
            {match && table ? (
              <>
                <OrganizationFilePreview table={table} match={match} />
                <OrganizationMatchChecklist table={table} match={match} />
              </>
            ) : null}
            {match ? <ImportMatchNextSteps remaining={remaining} onDownloadTemplate={() => void downloadTemplate()} /> : null}
          </aside>
        </div>
      </PageContainer>
      {match ? (
        <ImportMatchFooter
          uploadHref="/organization/import"
          reviewHref={importStageHref(session.id, "review")}
          remaining={remaining}
          canContinue={match.readiness.canContinue && !running}
        />
      ) : null}
    </section>
  );
}

function OrganizationFilePreview({ table, match }: { table: OrganizationSourceTable; match: OrganizationImportMatch }) {
  const t = useTranslations("orgImport.match.preview");
  const PREVIEW_COLUMNS = [
    { key: "code", label: t("code"), nowrap: true, strong: true },
    { key: "name", label: t("name") },
    { key: "parent", label: t("parent"), nowrap: true },
    { key: "type", label: t("type") },
  ];
  const buildRows = useCallback(
    (limit: number) =>
      buildMatchPreview(table, match, limit).map((row) => ({
        key: row.rowNumber,
        cells: [
          row.businessCode,
          row.name,
          row.parentCode,
          row.type.kind === "empty" ? null : row.type.kind === "matched" ? row.type.label : <PreviewUnmatched value={row.type.sourceValue} />,
        ],
      })),
    [table, match]
  );
  return <ImportFilePreview columns={PREVIEW_COLUMNS} totalRows={table.rows.length} buildRows={buildRows} />;
}

function OrganizationMatchChecklist({ table, match }: { table: OrganizationSourceTable; match: OrganizationImportMatch }) {
  const t = useTranslations("orgImport.match.checklist");
  const say = useSay("orgImport");
  const summary = summarizeMatch(match, say);
  const columns = countMappedColumns(table, match);
  return (
    <ImportMatchChecklist
      lines={[
        { label: t("shape"), value: summary.shapeLabel, done: summary.shapeResolved },
        {
          label: t("columns"),
          value: t("columnsValue", { mapped: columns.mapped, total: columns.total }),
          done: !match.readiness.requiredDecisions.some((d) => d.kind === "FieldMapping"),
        },
        {
          label: t("types"),
          value: t("typesValue", { resolved: summary.typesResolved, total: summary.typesTotal }),
          done: summary.typesResolved === summary.typesTotal,
        },
        {
          label: t("items"),
          value: summary.needsReview ? t("remaining", { count: summary.needsReview }) : t("none"),
          done: summary.needsReview === 0,
        },
      ]}
    />
  );
}
