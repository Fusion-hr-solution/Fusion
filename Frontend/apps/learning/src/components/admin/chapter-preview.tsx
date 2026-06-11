"use client";

import { useTranslations } from "next-intl";
import { Video, FileText, BookOpen, Dumbbell, X } from "lucide-react";
import { Button } from "@repo/ui";
import type { AdminContentBlock } from "@/types/admin";
import type { ChapterLayout } from "@/types";

/** Resolve backend asset paths to full URLs in dev/preview. */
function resolveAssetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const origin = base.replace(/\/api\/?$/, "");
  return origin ? `${origin}${path}` : path;
}

function isEmbedUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.com/i.test(
    url
  );
}

function toEmbedUrl(url: string): string {
  const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

const BLOCK_TYPE_ICON = {
  Video: Video,
  Pdf: FileText,
  Article: BookOpen,
  Exercise: Dumbbell,
} as const;

const KNOWN_BLOCK_TYPES = new Set(["Video", "Pdf", "Article", "Exercise"]);

interface ChapterPreviewProps {
  title: string;
  layout: ChapterLayout;
  blocks: AdminContentBlock[];
  onClose: () => void;
}

export function ChapterPreview({
  title,
  layout,
  blocks,
  onClose,
}: ChapterPreviewProps) {
  const t = useTranslations("adminChapters");
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Preview header bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-700">
            {t("preview.badge")}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("preview.employeeView")}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <X className="h-4 w-4" />
          {t("preview.close")}
        </Button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("preview.blockCount", { count: blocks.length })}
            </p>
          </div>

          {blocks.length === 0 ? (
            <EmptyPreview />
          ) : (
            <PreviewBlocks layout={layout} blocks={blocks} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPreview() {
  const t = useTranslations("adminChapters");
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-8 py-16 text-center">
      <BookOpen
        className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{t("preview.empty")}</p>
    </div>
  );
}

function PreviewBlocks({
  layout,
  blocks,
}: {
  layout: ChapterLayout;
  blocks: AdminContentBlock[];
}) {
  const blockElements = (list: AdminContentBlock[], startIndex: number) =>
    list.map((block, i) => (
      <PreviewBlockView key={block.id} block={block} index={startIndex + i} />
    ));

  if (layout === "SplitLayout" && blocks.length >= 2) {
    const mid = Math.ceil(blocks.length / 2);
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {blockElements(blocks.slice(0, mid), 0)}
        </div>
        <div className="space-y-6">{blockElements(blocks.slice(mid), mid)}</div>
      </div>
    );
  }

  if (layout === "MultiSection") {
    return (
      <div className="space-y-10">
        {blocks.map((block, i) => (
          <div key={block.id}>
            {i > 0 && <hr className="mb-6 border-border/40" />}
            <PreviewBlockView block={block} index={i} />
          </div>
        ))}
      </div>
    );
  }

  return <div className="space-y-8">{blockElements(blocks, 0)}</div>;
}

function PreviewBlockView({
  block,
  index,
}: {
  block: AdminContentBlock;
  index: number;
}) {
  const t = useTranslations("adminChapters");
  const blockType = block.type as keyof typeof BLOCK_TYPE_ICON;
  const TypeIcon = BLOCK_TYPE_ICON[blockType] ?? BookOpen;
  const typeLabel = KNOWN_BLOCK_TYPES.has(block.type)
    ? t(`preview.blockTypeLabel.${block.type}`)
    : block.type;

  return (
    <div
      className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Block header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--ey-blue-500))]/10 ring-1 ring-[hsl(var(--ey-blue-500))]/20">
          <TypeIcon
            className="h-4 w-4 text-[hsl(var(--ey-blue-500))]"
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {block.title || typeLabel}
          </p>
          <span className="text-xs text-muted-foreground">
            {typeLabel}
            {block.estimatedDurationMinutes
              ? ` · ${t("preview.minutes", { count: block.estimatedDurationMinutes })}`
              : ""}
          </span>
        </div>
      </div>

      {/* Block content */}
      {blockType === "Video" &&
        renderVideoPreview(block, t("preview.videoFallbackTitle"))}

      {blockType === "Pdf" && block.contentUri && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-border aspect-[3/4]">
            <object
              data={`${resolveAssetUrl(block.contentUri)}#toolbar=1&view=FitH`}
              type="application/pdf"
              title={block.title ?? t("preview.pdfFallbackTitle")}
              className="h-full w-full"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center">
                <FileText
                  className="h-10 w-10 text-muted-foreground/40"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  {t("preview.pdfCannotDisplay")}
                </p>
                <a
                  href={resolveAssetUrl(block.contentUri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t("preview.openPdf")}
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
            {t("preview.openPdfNewTab")}
          </a>
        </div>
      )}

      {(blockType === "Article" || blockType === "Exercise") &&
        block.textContent &&
        renderArticleContent(block.textContent)}

      {!block.textContent && !block.videoUrl && !block.contentUri && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("preview.contentNotAvailable")}
          </p>
        </div>
      )}
    </div>
  );
}

function renderVideoPreview(block: AdminContentBlock, fallbackTitle: string) {
  if (block.contentUri) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <video
          src={resolveAssetUrl(block.contentUri)}
          title={block.title ?? fallbackTitle}
          className="h-full w-full"
          controls
          preload="metadata"
        />
      </div>
    );
  }
  if (block.videoUrl && isEmbedUrl(block.videoUrl)) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <iframe
          src={toEmbedUrl(block.videoUrl)}
          title={block.title ?? fallbackTitle}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (block.videoUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
        <video
          src={block.videoUrl}
          title={block.title ?? fallbackTitle}
          className="h-full w-full"
          controls
          preload="metadata"
        />
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
          {(parsed.sections as { label: string; content: string }[]).map(
            (s) => (
              <section key={s.label}>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {s.label}
                </h2>
                <div
                  className="article-body text-sm leading-relaxed text-foreground/90"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(s.content),
                  }}
                />
              </section>
            )
          )}
        </article>
      );
    }
    if (parsed.sections && typeof parsed.sections === "object") {
      const entries = Object.entries(parsed.sections) as [string, string][];
      return (
        <article className="article-content max-w-none space-y-4">
          {entries.map(([label, content]) => (
            <section key={label}>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {label}
              </h2>
              <div
                className="article-body text-sm leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(String(content)),
                }}
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
