"use client";

import { Label } from "@repo/ui";
import { useTranslations } from "next-intl";
import { FileUploadZone } from "../file-upload-zone";

interface PdfEditorProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function PdfEditor({ file, onFileChange }: PdfEditorProps) {
  const t = useTranslations("adminWizard.editor.pdf");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[13px] font-semibold">{t("label")}</Label>
        <FileUploadZone
          accept=".pdf"
          file={file}
          onFileChange={onFileChange}
          label={t("uploadLabel")}
        />
      </div>
    </div>
  );
}
