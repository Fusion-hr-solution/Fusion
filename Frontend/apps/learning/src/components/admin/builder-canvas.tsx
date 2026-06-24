"use client";

import { useTranslations } from "next-intl";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Inbox, Columns2, LayoutList } from "lucide-react";
import type { AdminContentBlock } from "@/types/admin";
import type { ChapterLayout } from "@/types";
import { CanvasBlock } from "./canvas-block";

interface BuilderCanvasProps {
  blocks: AdminContentBlock[];
  layout: ChapterLayout;
  isOver: boolean;
  onEditBlock: (block: AdminContentBlock) => void;
  onDeleteBlock: (block: AdminContentBlock) => void;
}

export function BuilderCanvas({
  blocks,
  layout,
  isOver,
  onEditBlock,
  onDeleteBlock,
}: BuilderCanvasProps) {
  const t = useTranslations("adminChapters");
  const { setNodeRef } = useDroppable({
    id: "builder-canvas",
    data: { target: "canvas" },
  });

  const layoutLabel = t(`canvas.layout.${layout}`);

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] rounded-2xl border-2 border-dashed p-4 transition-all ${
        isOver
          ? "border-foreground/30 bg-muted/30 shadow-inner"
          : blocks.length > 0
            ? "border-transparent"
            : "border-border/40 bg-muted/10"
      }`}
    >
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
              isOver ? "bg-foreground/10" : "bg-muted"
            }`}
          >
            <Inbox
              className={`h-6 w-6 transition-colors ${
                isOver ? "text-foreground" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="text-center">
            <p
              className={`text-sm font-semibold transition-colors ${
                isOver ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {isOver ? t("canvas.dropToAdd") : t("canvas.startBuilding")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("canvas.dragHint")}
            </p>
          </div>
        </div>
      ) : (
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Layout indicator badge */}
          <div className="mb-3 flex items-center gap-2">
            {layout === "SplitLayout" ? (
              <Columns2 className="h-3.5 w-3.5 text-muted-foreground" />
            ) : layout === "MultiSection" ? (
              <LayoutList className="h-3.5 w-3.5 text-muted-foreground" />
            ) : null}
            <span className="text-[11px] font-medium text-muted-foreground">
              {layoutLabel}
            </span>
          </div>

          {/* Layout-aware block rendering */}
          {layout === "SplitLayout" && blocks.length >= 2
            ? renderSplitLayout(
                blocks,
                onEditBlock,
                onDeleteBlock,
                t("canvas.left"),
                t("canvas.right")
              )
            : layout === "MultiSection"
              ? renderMultiSectionLayout(
                  blocks,
                  onEditBlock,
                  onDeleteBlock,
                  (n) => t("canvas.section", { number: n })
                )
              : renderSingleLayout(blocks, onEditBlock, onDeleteBlock)}

          {/* Drop indicator at the bottom */}
          {isOver && (
            <div className="mt-2 flex items-center justify-center rounded-xl border-2 border-dashed border-foreground/20 py-4">
              <p className="text-xs font-medium text-muted-foreground">
                {t("canvas.dropHere")}
              </p>
            </div>
          )}
        </SortableContext>
      )}
    </div>
  );
}

function renderSingleLayout(
  blocks: AdminContentBlock[],
  onEdit: (b: AdminContentBlock) => void,
  onDelete: (b: AdminContentBlock) => void
) {
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <CanvasBlock
          key={block.id}
          block={block}
          index={i}
          onEdit={() => onEdit(block)}
          onDelete={() => onDelete(block)}
        />
      ))}
    </div>
  );
}

function renderSplitLayout(
  blocks: AdminContentBlock[],
  onEdit: (b: AdminContentBlock) => void,
  onDelete: (b: AdminContentBlock) => void,
  leftLabel: string,
  rightLabel: string
) {
  const mid = Math.ceil(blocks.length / 2);
  const left = blocks.slice(0, mid);
  const right = blocks.slice(mid);
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2 rounded-xl border border-dashed border-border/30 bg-muted/5 p-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {leftLabel}
        </p>
        {left.map((block, i) => (
          <CanvasBlock
            key={block.id}
            block={block}
            index={i}
            onEdit={() => onEdit(block)}
            onDelete={() => onDelete(block)}
          />
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-dashed border-border/30 bg-muted/5 p-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {rightLabel}
        </p>
        {right.map((block, i) => (
          <CanvasBlock
            key={block.id}
            block={block}
            index={mid + i}
            onEdit={() => onEdit(block)}
            onDelete={() => onDelete(block)}
          />
        ))}
      </div>
    </div>
  );
}

function renderMultiSectionLayout(
  blocks: AdminContentBlock[],
  onEdit: (b: AdminContentBlock) => void,
  onDelete: (b: AdminContentBlock) => void,
  sectionLabel: (n: number) => string
) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <div
          key={block.id}
          className="rounded-xl border border-border/30 bg-muted/5 p-3"
        >
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {sectionLabel(i + 1)}
          </p>
          <CanvasBlock
            block={block}
            index={i}
            onEdit={() => onEdit(block)}
            onDelete={() => onDelete(block)}
          />
        </div>
      ))}
    </div>
  );
}
