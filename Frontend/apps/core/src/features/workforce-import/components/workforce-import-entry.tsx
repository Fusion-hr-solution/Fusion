"use client";

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
  const { user, isLoading } = useAuth();
  if (isLoading) return <ImportUploadSkeleton domain="workforce" />;
  if (!canImportCoreEmployees(user))
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import workforce" />
        <PagePermissionNotice
          title="Workforce import access required"
          description="You don’t have permission to import workforce into this tenant."
          action={
            <Button asChild variant="outline">
              <Link href="/people">Back to People</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  return <WorkforceUpload />;
}

function WorkforceUpload() {
  const api = useWorkforceImportApi();
  const active = useActiveWorkforceImport();
  const latest = active.data ?? null;
  const today = todayCalendarDate();

  return (
    <ImportUpload
      title="Import workforce"
      context="Bring in your people from Excel or CSV and review them before publishing."
      fileNoun="workforce"
      sectionTitle="File and workforce date"
      sectionDescription="Select your workforce file and the date it describes."
      date={{
        label: "Workforce as of",
        tooltip: "The date your file describes. People are established as employed on this date.",
        initial: today,
        validate: (value) =>
          !isValidEffectiveDate(value) ? "Choose a valid date." : value > today ? "Choose today or an earlier date. Use Hire for future employees." : null,
      }}
      cancelHref="/people"
      onDownloadTemplate={async () => {
        try {
          downloadBlob(await api.downloadTemplate(), "Fusion-workforce-template.xlsx");
        } catch (e) {
          toast.error("Template could not be downloaded", { description: translateWorkforceImportError(e).message });
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
          message: result.conflictReason ?? "This file changed while it was being uploaded. Choose it again.",
          retryable: false,
        });
      }}
      classifyError={(error) =>
        error instanceof UploadRefusal ? error.problem : classifyIntakeProblem(translateWorkforceImportError(error))
      }
    />
  );
}
