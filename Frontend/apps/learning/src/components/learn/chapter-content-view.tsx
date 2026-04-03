"use client";

import { Video, FileText, BookOpen, Dumbbell, CheckCircle2 } from "lucide-react";
import type { ChapterContentViewProps } from "@/types/component-props";
import { ChapterNavigation } from "./chapter-navigation";

const CONTENT_TYPE_ICON = {
  video: Video,
  pdf: FileText,
  article: BookOpen,
  exercise: Dumbbell,
} as const;

const CONTENT_TYPE_LABEL = {
  video: "Video Lesson",
  pdf: "PDF Document",
  article: "Article",
  exercise: "Exercise",
} as const;

export function ChapterContentView({
  chapter,
  isCompleted,
  isLast,
  onMarkComplete,
  onNext,
  onPrevious,
  hasPrevious,
  isLoading,
}: ChapterContentViewProps) {
  const TypeIcon = CONTENT_TYPE_ICON[chapter.contentType];
  const typeLabel = CONTENT_TYPE_LABEL[chapter.contentType];

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      {/* Chapter header */}
      <div className="ey-animate-fade-up mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--ey-blue-500))]/10 ring-1 ring-[hsl(var(--ey-blue-500))]/20">
            <TypeIcon className="h-5 w-5 text-[hsl(var(--ey-blue-500))]" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {typeLabel}
            </span>
            {chapter.estimatedDurationMinutes && (
              <span className="ml-2 text-xs text-muted-foreground">
                · {chapter.estimatedDurationMinutes} min
              </span>
            )}
          </div>
          {isCompleted && (
            <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--ey-green-500))]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Completed
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
          {chapter.title}
        </h1>
      </div>

      {/* Content body */}
      <div className="ey-animate-fade-up" style={{ animationDelay: "100ms" }}>
        {chapter.contentType === "video" && chapter.videoUrl && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-black aspect-video">
            <iframe
              src={chapter.videoUrl}
              title={chapter.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {chapter.contentType === "pdf" && chapter.contentUri && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-border aspect-[3/4]">
            <iframe
              src={chapter.contentUri}
              title={chapter.title}
              className="h-full w-full"
            />
          </div>
        )}

        {chapter.textContent && renderArticleContent(chapter.textContent)}

        {!chapter.textContent && !chapter.videoUrl && !chapter.contentUri && (
          <div className="mb-8 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-8 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Content for this chapter is not yet available.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ChapterNavigation
        isCompleted={isCompleted}
        isLast={isLast}
        onMarkComplete={onMarkComplete}
        onNext={onNext}
        onPrevious={onPrevious}
        hasPrevious={hasPrevious}
        isLoading={isLoading}
      />
    </div>
  );
}

/** Render article content — structured JSON sections or plain markdown. */
function renderArticleContent(textContent: string) {
  try {
    const parsed = JSON.parse(textContent);
    if (parsed.sections && typeof parsed.sections === "object") {
      const entries = Object.entries(parsed.sections) as [string, string][];
      return (
        <article className="prose prose-sm max-w-none mb-8 space-y-6 rounded-2xl border border-border/50 bg-white p-8 shadow-sm">
          {entries.map(([label, content]) => (
            <section key={label}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{label}</h2>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(String(content)) }} />
            </section>
          ))}
        </article>
      );
    }
  } catch {
    // Not JSON — fall through to markdown rendering
  }
  return (
    <article className="prose prose-sm max-w-none mb-8 rounded-2xl border border-border/50 bg-white p-8 shadow-sm">
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(textContent) }} />
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
