"use client";

import { translateOrganizationImportError } from "@repo/api";
import { toast } from "sonner";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import { useOrganizationReadiness } from "@/features/organization/api/use-organization";
import { ImportUpload } from "@/features/data-import/components/import-upload";
import { classifyIntakeProblem, isValidEffectiveDate } from "@/features/data-import/model/upload-source";
import { downloadBlob } from "../model/format";
import { useActiveOrganizationImports, useOrganizationImportApi, useOrganizationImportMutations } from "../api/use-organization-import";
import { importStageHref } from "../model/import-stage";

export { uploadHandoffTiming } from "@/features/data-import/components/import-upload";

/**
 * Upload for an Organization import: the shared Upload with the organization's intake, template,
 * export and resume. A new upload always lands on Match, even when everything was matched: the
 * administrator sees what was understood before moving on.
 */
export function UploadStage() {
  const api = useOrganizationImportApi();
  const { intake } = useOrganizationImportMutations();
  const active = useActiveOrganizationImports();
  const readiness = useOrganizationReadiness();
  const latest = active.data?.[0] ?? null;

  async function download(kind: "template" | "export", effectiveDate: string) {
    try {
      const blob = kind === "template" ? await api.downloadTemplate() : await api.exportStructure(effectiveDate);
      downloadBlob(blob, kind === "template" ? "Fusion-organization-template.xlsx" : `Fusion-organization-${effectiveDate}.xlsx`);
    } catch (error) {
      toast.error(kind === "template" ? "Template could not be downloaded" : "Structure could not be exported", {
        description: translateOrganizationImportError(error).message,
      });
    }
  }

  return (
    <ImportUpload
      title="Import organization structure"
      context="Bring in your structure from Excel or CSV and review it before publishing."
      fileNoun="organization"
      sectionTitle="File and effective date"
      sectionDescription="Select your organization file and choose when the changes should take effect."
      date={{
        label: "Effective date",
        tooltip: "Changes will be staged with this effective date.",
        initial: todayCalendarDate(),
        validate: (value) => (isValidEffectiveDate(value) ? null : "Choose a valid effective date."),
      }}
      cancelHref="/organization"
      onDownloadTemplate={() => void download("template", todayCalendarDate())}
      templateExtra={(effectiveDate) =>
        readiness.data?.hasPermanentRoot ? (
          <button
            type="button"
            onClick={() => void download("export", effectiveDate)}
            className="mt-1 rounded-sm type-meta text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Export current structure
          </button>
        ) : null
      }
      resume={
        latest
          ? { fileName: latest.originalFileName, savedAt: latest.updatedAt ?? latest.createdAt, href: `/organization/import/${latest.id}` }
          : null
      }
      intake={async ({ file, token, date, sheet }) => {
        const result = await intake.mutateAsync({ file, creationToken: token, effectiveDate: date, selectedSheetName: sheet });
        if (result.kind === "SheetSelectionRequired") return { kind: "sheet", sheets: result.sheetSelection.candidateSheetNames };
        return { kind: "ready", href: importStageHref(result.session.id, "match") };
      }}
      classifyError={(error) => classifyIntakeProblem(translateOrganizationImportError(error))}
    />
  );
}
