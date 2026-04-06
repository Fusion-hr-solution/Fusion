"use client";

import { useState } from "react";
import { Input, Label } from "@repo/ui";
import type { ChapterFormContentStepProps } from "@/types/admin-props";
import { FileUploadZone } from "./file-upload-zone";

export function ChapterFormContentStep({
  contentType,
  file,
  onFileChange,
  existingFileUrl,
  textContent,
  onTextContentChange,
  videoUrl,
  onVideoUrlChange,
  estimatedDuration,
  onEstimatedDurationChange,
  isUploading,
  fieldErrors = {},
}: ChapterFormContentStepProps) {
  const [videoMode, setVideoMode] = useState<"upload" | "url">(existingFileUrl ? "upload" : "url");

  return (
    <div className="space-y-4">
      {contentType === "Pdf" && (
        <div className="space-y-2">
          <Label>PDF File *</Label>
          <FileUploadZone
            accept=".pdf"
            file={file}
            onFileChange={onFileChange}
            existingUrl={existingFileUrl}
            label="Upload a PDF file (max 50 MB)"
            disabled={isUploading}
            error={fieldErrors.file}
          />
        </div>
      )}

      {contentType === "Video" && (
        <div className="space-y-3">
          <Label>Video Content *</Label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${videoMode === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              onClick={() => setVideoMode("upload")}
            >
              Upload file
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${videoMode === "url" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              onClick={() => setVideoMode("url")}
            >
              Enter URL
            </button>
          </div>
          {videoMode === "upload" ? (
            <FileUploadZone
              accept=".mp4,.webm,.mov"
              file={file}
              onFileChange={onFileChange}
              existingUrl={existingFileUrl}
              label="Upload a video file (max 50 MB)"
              disabled={isUploading}
              error={fieldErrors.file}
            />
          ) : (
            <div className="space-y-1">
              <Input
                maxLength={500}
                value={videoUrl}
                onChange={(e) => onVideoUrlChange(e.target.value)}
                placeholder="https://youtube.com/..."
                className={fieldErrors.videoUrl ? "border-destructive" : ""}
              />
              {fieldErrors.videoUrl && <p className="text-xs text-destructive">{fieldErrors.videoUrl}</p>}
            </div>
          )}
        </div>
      )}

      {(contentType === "Article" || contentType === "Exercise") && (
        <div className="space-y-2">
          <Label htmlFor="ch-text">Text Content</Label>
          <textarea
            id="ch-text"
            rows={6}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={textContent}
            onChange={(e) => onTextContentChange(e.target.value)}
            placeholder="Chapter content..."
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ch-duration">Estimated Duration (minutes)</Label>
        <Input
          id="ch-duration"
          type="number"
          min={1}
          max={600}
          value={estimatedDuration}
          onChange={(e) =>
            onEstimatedDurationChange(e.target.value ? Number(e.target.value) : "")
          }
          className={fieldErrors.estimatedDuration ? "border-destructive" : ""}
        />
        {fieldErrors.estimatedDuration && <p className="text-xs text-destructive">{fieldErrors.estimatedDuration}</p>}
      </div>
    </div>
  );
}
