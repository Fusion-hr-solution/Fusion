"use client";

import { Label } from "@repo/ui";
import { FileUploadZone } from "../file-upload-zone";

interface PdfEditorProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function PdfEditor({ file, onFileChange }: PdfEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[13px] font-semibold">PDF File</Label>
        <FileUploadZone
          accept=".pdf"
          file={file}
          onFileChange={onFileChange}
          label="Upload a PDF document (max 50 MB)"
        />
      </div>
    </div>
  );
}
