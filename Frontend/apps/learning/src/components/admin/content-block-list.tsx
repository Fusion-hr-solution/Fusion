"use client";

import { useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock } from "lucide-react";
import { Button } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { deleteContentBlock } from "@/services/admin-service";
import type { AdminContentBlock } from "@/types/admin";
import { ContentBlockEditorDialog } from "./content-block-editor-dialog";
import { CONTENT_TYPES } from "@/data/chapter-templates";

interface ContentBlockListProps {
  trainingId: string;
  chapterId: string;
  blocks: AdminContentBlock[];
  isDeleted: boolean;
  onRefetch: () => void;
  isDropTarget?: boolean;
}

/* ── Single sortable block row ── */

function SortableBlockItem({
  block,
  index,
  isDeleted,
  onEdit,
  onDelete,
}: {
  block: AdminContentBlock;
  index: number;
  isDeleted: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { source: "block", block },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const typeConfig = CONTENT_TYPES.find((t) => t.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors ${
        isDragging ? "border-foreground/30 shadow-md" : "border-border/30 hover:bg-muted/30"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
        disabled={isDeleted}
        aria-label="Drag to reorder block"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-muted-foreground bg-muted">
        {index + 1}
      </span>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${typeConfig?.colorClass ?? "bg-muted"}`}>
        {typeConfig && <typeConfig.icon className={`h-3 w-3 ${typeConfig.iconColorClass}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {block.title || block.type}
        </p>
        {block.estimatedDurationMinutes && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" /> {block.estimatedDurationMinutes} min
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit} disabled={isDeleted}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleted}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* ── Drop zone + sortable block list ── */

export function ContentBlockList({
  trainingId,
  chapterId,
  blocks,
  isDeleted,
  onRefetch,
  isDropTarget = false,
}: ContentBlockListProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AdminContentBlock | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${chapterId}`,
    data: { chapterId },
  });

  const { mutateAsync: doDelete } = useApiMutation(
    (blockId: string) => deleteContentBlock(trainingId, chapterId, blockId),
    { onSuccess: onRefetch },
  );

  const handleDelete = useCallback(
    async (block: AdminContentBlock) => {
      if (!confirm(`Delete "${block.title || block.type}"?`)) return;
      await doDelete(block.id);
    },
    [doDelete],
  );

  const sorted = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-2">
      <div
        ref={setNodeRef}
        className={`min-h-[48px] rounded-xl border-2 border-dashed p-2 transition-all ${
          isOver
            ? "border-foreground/40 bg-muted/40 shadow-inner"
            : isDropTarget
              ? "border-border/50 bg-muted/10"
              : "border-transparent"
        }`}
      >
        {sorted.length === 0 ? (
          <p className={`py-6 text-center text-xs transition-colors ${
            isOver ? "text-foreground font-medium" : "text-muted-foreground"
          }`}>
            {isOver ? "Drop here to add" : "Drag content from the palette"}
          </p>
        ) : (
          <SortableContext items={sorted.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {sorted.map((block, i) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  index={i}
                  isDeleted={isDeleted}
                  onEdit={() => { setEditingBlock(block); setEditorOpen(true); }}
                  onDelete={() => handleDelete(block)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      <ContentBlockEditorDialog
        trainingId={trainingId}
        chapterId={chapterId}
        block={editingBlock}
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditingBlock(null); }}
        onSaved={onRefetch}
      />
    </div>
  );
}
