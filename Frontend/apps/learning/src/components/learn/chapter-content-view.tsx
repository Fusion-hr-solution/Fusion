"use client";

import { Video, FileText, BookOpen, Dumbbell, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@repo/ui";
import type { ChapterContentViewProps } from "@/types/component-props";
import type { ContentBlock, ChapterLayout } from "@/types";
import { ChapterNavigation } from "./chapter-navigation";

/**
 * Resolve a backend asset path (e.g. /api/training/uploads/...) to a full URL.
 * In dev the frontend and backend run on different ports, so relative paths
 * would hit the Next.js server instead of the API gateway.
 */
function resolveAssetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;             // already absolute
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";  // e.g. http://localhost:5000/api
  const origin = base.replace(/\/api\/?$/, "");             // e.g. http://localhost:5000
  return origin ? `${origin}${path}` : path;
}

/** Detect embeddable video URLs (YouTube, Vimeo, etc.) */
function isEmbedUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.com/i.test(url);
}

/** Convert a regular YouTube/Vimeo URL to its embed counterpart. */
function toEmbedUrl(url: string): string {
  // YouTube watch URLs → embed
  const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;

  // Vimeo URLs → player embed
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  // Already embed-ready or other provider
  return url;
}

/** Render video content — embedded iframe for YouTube/Vimeo, native player for uploads */
function renderVideoContent(block: ContentBlock) {
  // Uploaded video file takes priority
  if (block.contentUri) {
    const src = resolveAssetUrl(block.contentUri);
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <video
          src={src}
          title={block.title ?? "Video"}
          className="h-full w-full"
          controls
          controlsList="nodownload"
          preload="metadata"
        />
      </div>
    );
  }

  // Embeddable URL (YouTube, Vimeo, etc.)
  if (block.videoUrl && isEmbedUrl(block.videoUrl)) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <iframe
          src={toEmbedUrl(block.videoUrl)}
          title={block.title ?? "Video"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Direct video URL (non-embeddable)
  if (block.videoUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <video
          src={block.videoUrl}
          title={block.title ?? "Video"}
          className="h-full w-full"
          controls
          controlsList="nodownload"
          preload="metadata"
        />
      </div>
    );
  }

  return null;
}

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

export function ChapterContentView({
  chapter,
  completedBlockIds,
  isLast,
  onMarkBlockComplete,
  onNext,
  onPrevious,
  hasPrevious,
  isLoading,
  examAvailable,
  onStartExam,
}: ChapterContentViewProps) {
  const sortedBlocks = [...chapter.contentBlocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const allBlocksCompleted = sortedBlocks.length > 0 && sortedBlocks.every((b) => completedBlockIds.has(b.id));

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      {/* Chapter header */}
      <div className="ey-animate-fade-up mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
          {chapter.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sortedBlocks.length} {sortedBlocks.length === 1 ? "block" : "blocks"}
          {" · "}
          {completedBlockIds.size}/{sortedBlocks.length} completed
        </p>
      </div>

      {/* Content blocks */}
      {renderBlocksWithLayout(sortedBlocks, chapter.layout, completedBlockIds, onMarkBlockComplete, isLoading)}

      {/* Navigation */}
      <ChapterNavigation
        allBlocksCompleted={allBlocksCompleted}
        isLast={isLast}
        onNext={onNext}
        onPrevious={onPrevious}
        hasPrevious={hasPrevious}
        isLoading={isLoading}
        examAvailable={examAvailable}
        onStartExam={onStartExam}
      />
    </div>
  );
}

/* ── Layout-aware block renderer ── */

function renderBlocksWithLayout(
  blocks: ContentBlock[],
  layout: ChapterLayout,
  completedBlockIds: Set<string>,
  onMarkBlockComplete: (blockId: string) => void,
  isLoading: boolean,
) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-8 py-16 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Content for this chapter is not yet available.
        </p>
      </div>
    );
  }

  const blockElements = (list: ContentBlock[], startIndex: number) =>
    list.map((block, i) => (
      <ContentBlockView
        key={block.id}
        block={block}
        index={startIndex + i}
        isCompleted={completedBlockIds.has(block.id)}
        onMarkComplete={() => onMarkBlockComplete(block.id)}
        isLoading={isLoading}
      />
    ));

  if (layout === "SplitLayout" && blocks.length >= 2) {
    const mid = Math.ceil(blocks.length / 2);
    const left = blocks.slice(0, mid);
    const right = blocks.slice(mid);
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">{blockElements(left, 0)}</div>
        <div className="space-y-6">{blockElements(right, mid)}</div>
      </div>
    );
  }

  if (layout === "MultiSection") {
    return (
      <div className="space-y-10">
        {blocks.map((block, i) => (
          <div key={block.id}>
            {i > 0 && <hr className="mb-6 border-border/40" />}
            <ContentBlockView
              block={block}
              index={i}
              isCompleted={completedBlockIds.has(block.id)}
              onMarkComplete={() => onMarkBlockComplete(block.id)}
              isLoading={isLoading}
            />
          </div>
        ))}
      </div>
    );
  }

  // SingleContent (default) — vertical stack
  return <div className="space-y-8">{blockElements(blocks, 0)}</div>;
}

/* ── Individual content block renderer ── */

function ContentBlockView({
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
    <div
      className="ey-animate-fade-up rounded-2xl border border-border/50 bg-white p-6 shadow-sm"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Block header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--ey-blue-500))]/10 ring-1 ring-[hsl(var(--ey-blue-500))]/20">
          <TypeIcon className="h-4 w-4 text-[hsl(var(--ey-blue-500))]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {block.title ?? typeLabel}
          </p>
          <span className="text-xs text-muted-foreground">
            {typeLabel}
            {block.estimatedDurationMinutes && ` · ${block.estimatedDurationMinutes} min`}
          </span>
        </div>
        {isCompleted ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--ey-green-500))]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Done
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkComplete}
            disabled={isLoading}
            className="gap-1.5 text-xs"
          >
            <Circle className="h-3.5 w-3.5" aria-hidden="true" />
            Mark done
          </Button>
        )}
      </div>

      {/* Block content */}
      {block.type === "video" && renderVideoContent(block)}

      {block.type === "pdf" && block.contentUri && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-border aspect-[3/4]">
            <object
              data={`${resolveAssetUrl(block.contentUri)}#toolbar=1&view=FitH`}
              type="application/pdf"
              title={block.title ?? "PDF"}
              className="h-full w-full"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Your browser cannot display this PDF inline.
                </p>
                <a
                  href={resolveAssetUrl(block.contentUri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Open PDF
                </a>
              </div>
            </object>
          </div>
          <a
            href={resolveAssetUrl(block.contentUri)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--ey-blue-500))] hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Open PDF in new tab
          </a>
        </div>
      )}

      {(block.type === "article" || block.type === "exercise") && block.textContent && (
        renderArticleContent(block.textContent)
      )}

      {!block.textContent && !block.videoUrl && !block.contentUri && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Content not yet available.</p>
        </div>
      )}
    </div>
  );
}

/** Render article/exercise text content — structured JSON sections or plain markdown. */
function renderArticleContent(textContent: string) {
  try {
    const parsed = JSON.parse(textContent);
    if (Array.isArray(parsed.sections)) {
      const sections = parsed.sections as { label: string; content: string }[];
      return (
        <article className="article-content max-w-none space-y-4">
          {sections.map((s) => (
            <section key={s.label}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{s.label}</h2>
              <div
                className="article-body text-sm leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(s.content) }}
              />
            </section>
          ))}
        </article>
      );
    }
    if (parsed.sections && typeof parsed.sections === "object") {
      const entries = Object.entries(parsed.sections) as [string, string][];
      return (
        <article className="article-content max-w-none space-y-4">
          {entries.map(([label, content]) => (
            <section key={label}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{label}</h2>
              <div
                className="article-body text-sm leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(String(content)) }}
              />
            </section>
          ))}
        </article>
      );
    }
  } catch {
    // Not JSON — fall through to markdown rendering
  }
  return (
    <article className="article-content max-w-none">
      <div
        className="article-body text-sm leading-relaxed text-foreground/90"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(textContent) }}
      />
    </article>
  );
}

/** Basic markdown-to-HTML for chapter content (headers, bold, lists, paragraphs). */
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>");
}
