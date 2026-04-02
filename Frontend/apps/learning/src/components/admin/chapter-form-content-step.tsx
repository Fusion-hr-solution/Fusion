import { Input, Label } from "@repo/ui";
import type { ChapterFormContentStepProps } from "@/types/admin-props";

export function ChapterFormContentStep({
  contentType,
  contentUri,
  onContentUriChange,
  textContent,
  onTextContentChange,
  videoUrl,
  onVideoUrlChange,
  estimatedDuration,
  onEstimatedDurationChange,
  fieldErrors = {},
}: ChapterFormContentStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ch-uri">Content URI</Label>
        <Input
          id="ch-uri"
          maxLength={500}
          value={contentUri}
          onChange={(e) => onContentUriChange(e.target.value)}
          placeholder="https://..."
          className={fieldErrors.contentUri ? "border-destructive" : ""}
        />
        {fieldErrors.contentUri && <p className="text-xs text-destructive">{fieldErrors.contentUri}</p>}
      </div>

      {contentType === "Video" && (
        <div className="space-y-2">
          <Label htmlFor="ch-video">Video URL</Label>
          <Input
            id="ch-video"
            maxLength={500}
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            placeholder="https://youtube.com/..."
            className={fieldErrors.videoUrl ? "border-destructive" : ""}
          />
          {fieldErrors.videoUrl && <p className="text-xs text-destructive">{fieldErrors.videoUrl}</p>}
        </div>
      )}

      {(contentType === "Article" || contentType === "Document") && (
        <div className="space-y-2">
          <Label htmlFor="ch-text">Text Content</Label>
          <textarea
            id="ch-text"
            rows={5}
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
