"use client";

import { useState } from "react";
import { Input, Label } from "@repo/ui";
import { useTranslations } from "next-intl";
import { FileUploadZone } from "../file-upload-zone";

interface VideoEditorProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  /** Existing uploaded file URL (admin edit mode) */
  existingFileUrl?: string;
  /** Validation error for the file field */
  fileError?: string;
  /** Validation error for the URL field */
  urlError?: string;
  /** Disable interactions while uploading */
  disabled?: boolean;
}

export function VideoEditor({
  file,
  onFileChange,
  videoUrl,
  onVideoUrlChange,
  existingFileUrl,
  fileError,
  urlError,
  disabled,
}: VideoEditorProps) {
  const t = useTranslations("adminWizard.editor.video");
  const [mode, setMode] = useState<"upload" | "url">(
    existingFileUrl ? "upload" : videoUrl ? "url" : "upload"
  );

  return (
    <div className="space-y-4">
      <Label className="text-[13px] font-semibold">{t("source")}</Label>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(["upload", "url"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={disabled}
            className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
              mode === m
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {m === "upload" ? t("uploadFile") : t("externalUrl")}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <FileUploadZone
          accept=".mp4,.webm,.mov"
          file={file}
          onFileChange={onFileChange}
          existingUrl={existingFileUrl}
          label={t("uploadLabel")}
          disabled={disabled}
          error={fileError}
        />
      ) : (
        <div className="space-y-2">
          <Input
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            disabled={disabled}
            className={urlError ? "border-destructive" : ""}
          />
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          <p className="text-[11px] text-muted-foreground">{t("urlHint")}</p>
        </div>
      )}
    </div>
  );
}
