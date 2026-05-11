import { Video, FileText, BookOpen, Dumbbell, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@repo/ui";
import type { ContentBlock } from "@/types";
import { resolveAssetUrl, isEmbedUrl, toEmbedUrl, renderMarkdown } from "./chapter-content-utils";

const BLOCK_TYPE_ICON = {
  video: Video,
  pdf: FileText,
  article: BookOpen,
  exercise: Dumbbell,
} as const;

const BLOCK_TYPE_LABEL = {
  video: "Video Lesson",
  pdf: "PDF Document",
  article: "Article",
  exercise: "Exercise",
} as const;

function renderVideoContent(block: ContentBlock) {
  if (block.contentUri) {
    const src = resolveAssetUrl(block.contentUri);
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <video src={src} title={block.title ?? "Video"} className="h-full w-full" controls controlsList="nodownload" preload="metadata" />
      </div>
    );
  }
  if (block.videoUrl && isEmbedUrl(block.videoUrl)) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <iframe src={toEmbedUrl(block.videoUrl)} title={block.title ?? "Video"} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  if (block.videoUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <video src={block.videoUrl} title={block.title ?? "Video"} className="h-full w-full" controls controlsList="nodownload" preload="metadata" />
      </div>
    );
  }
  return null;
}

function renderArticleContent(textContent: string) {
  try {
    const parsed = JSON.parse(textContent);
    if (Array.isArray(parsed.sections)) {
      return (
        <article className="article-content max-w-none space-y-4">
          {(parsed.sections as { label: string; content: string }[]).map((s) => (
            <section key={s.label}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{s.label}</h2>
              <div className="article-body text-sm leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.content) }} />
            </section>
          ))}
        </article>
      );
    }
    if (parsed.sections && typeof parsed.sections === "object") {
      return (
        <article className="article-content max-w-none space-y-4">
          {(Object.entries(parsed.sections) as [string, string][]).map(([label, content]) => (
            <section key={label}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{label}</h2>
              <div className="article-body text-sm leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: renderMarkdown(String(content)) }} />
            </section>
          ))}
        </article>
      );
    }
  } catch {
    // Not JSON — fall through
  }
  return (
    <article className="article-content max-w-none">
      <div className="article-body text-sm leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: renderMarkdown(textContent) }} />
    </article>
  );
}

export function ContentBlockView({
  block,
  index,
  isCompleted,
  onMarkComplete,
  isLoading,
}: {
  block: ContentBlock;
  index: number;
  isCompleted: boolean;
  onMarkComplete: () => void;
  isLoading: boolean;
}) {
  const TypeIcon = BLOCK_TYPE_ICON[block.type];
  const typeLabel = BLOCK_TYPE_LABEL[block.type];

  return (
    <div className="ey-animate-fade-up rounded-2xl border border-border/50 bg-white p-6 shadow-sm" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--ey-blue-500))]/10 ring-1 ring-[hsl(var(--ey-blue-500))]/20">
          <TypeIcon className="h-4 w-4 text-[hsl(var(--ey-blue-500))]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{block.title ?? typeLabel}</p>
          <span className="text-xs text-muted-foreground">{typeLabel}{block.estimatedDurationMinutes && ` · ${block.estimatedDurationMinutes} min`}</span>
        </div>
        {isCompleted ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--ey-green-500))]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Done
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={onMarkComplete} disabled={isLoading} className="gap-1.5 text-xs">
            <Circle className="h-3.5 w-3.5" aria-hidden="true" /> Mark done
          </Button>
        )}
      </div>

      {block.type === "video" && renderVideoContent(block)}

      {block.type === "pdf" && block.contentUri && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-border aspect-[3/4]">
            <object data={`${resolveAssetUrl(block.contentUri)}#toolbar=1&view=FitH`} type="application/pdf" title={block.title ?? "PDF"} className="h-full w-full">
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Your browser cannot display this PDF inline.</p>
                <a href={resolveAssetUrl(block.contentUri)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">Open PDF</a>
              </div>
            </object>
          </div>
          <a href={resolveAssetUrl(block.contentUri)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--ey-blue-500))] hover:underline">
            <FileText className="h-3.5 w-3.5" /> Open PDF in new tab
          </a>
        </div>
      )}

      {(block.type === "article" || block.type === "exercise") && block.textContent && renderArticleContent(block.textContent)}

      {!block.textContent && !block.videoUrl && !block.contentUri && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Content not yet available.</p>
        </div>
      )}
    </div>
  );
}
