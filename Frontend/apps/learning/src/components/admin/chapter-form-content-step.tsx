"use client";

import { useTranslations } from "next-intl";
import { Input, Label } from "@repo/ui";
import type { ChapterFormContentStepProps } from "@/types/admin-props";
import { FileUploadZone } from "./file-upload-zone";
import { ArticleTemplateSelector } from "./article-template-selector";
import { ArticleSectionEditor } from "./article-section-editor";
import { VideoEditor } from "./create-training-wizard/video-editor";

export function ChapterFormContentStep({
  content,
  handlers,
}: ChapterFormContentStepProps) {
  const t = useTranslations("adminChapters");
  const {
    contentType,
    file,
    existingFileUrl,
    textContent,
    videoUrl,
    estimatedDuration,
    isUploading,
    selectedTemplate,
    initialTemplateName,
    sectionValues,
    fieldErrors = {},
  } = content;
  const {
    onFileChange,
    onTextContentChange,
    onVideoUrlChange,
    onEstimatedDurationChange,
    onTemplateChange,
    onSectionChange,
  } = handlers;

  return (
    <div className="space-y-4">
      {contentType === "Pdf" && (
        <div className="space-y-2">
          <Label>{t("contentStep.pdfFileLabel")}</Label>
          <FileUploadZone
            accept=".pdf"
            file={file}
            onFileChange={onFileChange}
            existingUrl={existingFileUrl}
            label={t("contentStep.pdfUploadHint")}
            disabled={isUploading}
            error={fieldErrors.file}
          />
        </div>
      )}

      {contentType === "Video" && (
        <VideoEditor
          file={file}
          onFileChange={onFileChange}
          videoUrl={videoUrl}
          onVideoUrlChange={onVideoUrlChange}
          existingFileUrl={existingFileUrl}
          fileError={fieldErrors.file}
          urlError={fieldErrors.videoUrl}
          disabled={isUploading}
        />
      )}

      {contentType === "Article" && (
        <div className="space-y-4">
          <ArticleTemplateSelector
            selectedTemplateId={selectedTemplate?.id ?? ""}
            onTemplateChange={onTemplateChange}
            initialTemplateName={initialTemplateName}
          />
          {selectedTemplate && (
            <ArticleSectionEditor
              sections={selectedTemplate.sections}
              sectionValues={sectionValues}
              onSectionChange={onSectionChange}
            />
          )}
        </div>
      )}

      {contentType === "Exercise" && (
        <div className="space-y-2">
          <Label htmlFor="ch-text">{t("contentStep.textContentLabel")}</Label>
          <textarea
            id="ch-text"
            rows={6}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={textContent}
            onChange={(e) => onTextContentChange(e.target.value)}
            placeholder={t("contentStep.textContentPlaceholder")}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ch-duration">
          {t("contentStep.estimatedDurationLabel")}
        </Label>
        <Input
          id="ch-duration"
          type="number"
          min={1}
          max={600}
          value={estimatedDuration}
          onChange={(e) =>
            onEstimatedDurationChange(
              e.target.value ? Number(e.target.value) : ""
            )
          }
          className={fieldErrors.estimatedDuration ? "border-destructive" : ""}
        />
        {fieldErrors.estimatedDuration && (
          <p className="text-xs text-destructive">
            {fieldErrors.estimatedDuration}
          </p>
        )}
      </div>
    </div>
  );
}
