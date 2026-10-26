"use client";

import { useSay } from "@repo/ds/lib/say";
import { useImportProblem } from "@/features/data-import/components/import-words";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@repo/ds";
import { PageContainer, PageHeader, PagePermissionNotice } from "@repo/ds/shell";
import { translateWorkforceImportError } from "@repo/api";
import { canImportCoreEmployees, useAuth } from "@repo/auth";
import { toast } from "sonner";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import { downloadBlob } from "@/features/organization-import/model/format";
import { ImportUploadSkeleton } from "@/features/data-import/components/import-skeletons";
import { ImportUpload } from "@/features/data-import/components/import-upload";
import { classifyIntakeProblem, isValidEffectiveDate, type UploadProblem } from "@/features/data-import/model/upload-source";
import { useActiveWorkforceImport, useWorkforceImportApi } from "../api/use-workforce-import";

/** An intake refusal that is already an Upload problem (not an API error to translate). */
class UploadRefusal extends Error {
  constructor(readonly problem: UploadProblem) {
    super(problem.message);
  }
}

/**
 * Upload for a Workforce import: the shared Upload with the workforce's intake, template and
 * resume. Intake derives the attempt, so its URL resolves straight to Match or Review. A
 * corrected file is simply a new attempt.
 */
export function WorkforceImportEntry() {
  const t = useTranslations("wfImport");
  const { user, isLoading } = useAuth();
  if (isLoading) return <ImportUploadSkeleton domain="workforce" />;
  if (!canImportCoreEmployees(user))
    return (
      <PageContainer className="space-y-6">
        <PageHeader title={t("title")} />
        <PagePermissionNotice
          title={t("entry.accessTitle")}
          description={t("entry.accessDescription")}
          action={
            <Button asChild variant="outline">
              <Link href="/people">{t("entry.back")}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  return <WorkforceUpload />;
}

function WorkforceUpload() {
  const t = useTranslations("wfImport");
  const kit = useTranslations("dataImport");
  const say = useSay("dataImport");
  const english = useLocale() === "en";
  const problemLine = useImportProblem();
  const api = useWorkforceImportApi();
  const active = useActiveWorkforceImport();
  const latest = active.data ?? null;
  const today = todayCalendarDate();

  return (
    <ImportUpload
      title={t("title")}
      context={kit("domain.workforce.context")}
      fileNoun="workforce"
      sectionTitle={t("entry.sectionTitle")}
      sectionDescription={t("entry.sectionDescription")}
      date={{
        label: t("entry.dateLabel"),
        tooltip: t("entry.dateTooltip"),
        initial: today,
        validate: (value) =>
          !isValidEffectiveDate(value) ? t("entry.invalidDate") : value > today ? t("entry.futureDate") : null,
      }}
      cancelHref="/people"
      onDownloadTemplate={async () => {
        try {
          downloadBlob(await api.downloadTemplate(), "Fusion-workforce-template.xlsx");
        } catch (e) {
          toast.error(t("entry.templateFailed"), { description: problemLine(translateWorkforceImportError(e)) });
        }
      }}
      resume={
        latest?.source.fileName
          ? { fileName: latest.source.fileName, savedAt: latest.updatedAt, href: `/people/import/${latest.id}` }
          : null
      }
      intake={async ({ file, token, date, sheet }) => {
        const result = await api.intake({ file, creationToken: token, baselineDate: date, selectedSheet: sheet });
        if (result.kind === "SheetSelectionRequired" && result.sheetChoice)
          return { kind: "sheet", sheets: result.sheetChoice.sheets.map((s) => s.name) };
        if (result.kind === "HeaderClarificationRequired" && result.session && result.headerCandidates) {
          const session = result.session;
          return {
            kind: "header",
            candidates: result.headerCandidates,
            choose: async (rowIndex) => `/people/import/${(await api.selectHeader(session.id, session.version, rowIndex)).id}/match`,
          };
        }
        if (result.kind === "Ready" && result.session) return { kind: "ready", href: `/people/import/${result.session.id}/match` };
        throw new UploadRefusal({
          category: "SourceConflict",
          message: (english ? result.conflictReason : null) ?? say("problems.SourceConflict"),
          retryable: false,
        });
      }}
      classifyError={(error) =>
        error instanceof UploadRefusal ? error.problem : classifyIntakeProblem(translateWorkforceImportError(error), { say, english })
      }
    />
  );
}
