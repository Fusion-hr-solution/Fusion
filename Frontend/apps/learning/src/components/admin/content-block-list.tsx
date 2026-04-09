"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
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
}

export function ContentBlockList({ trainingId, chapterId, blocks, isDeleted, onRefetch }: ContentBlockListProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AdminContentBlock | null>(null);

  const { mutateAsync: doDelete } = useApiMutation(
    (blockId: string) => deleteContentBlock(trainingId, chapterId, blockId),
    { onSuccess: onRefetch },
  );

  const handleDelete = useCallback(async (block: AdminContentBlock) => {
    if (!confirm(`Delete content block "${block.title || block.type}"?`)) return;
    await doDelete(block.id);
  }, [doDelete]);

  const sorted = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content Blocks</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setEditingBlock(null); setEditorOpen(true); }}
          disabled={isDeleted}
          className="h-7 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" /> Add Block
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No content blocks yet. Add one to start building this chapter.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((block, i) => {
            const typeConfig = CONTENT_TYPES.find((t) => t.type === block.type);
            return (
              <div
                key={block.id}
                className="flex items-center gap-2.5 rounded-md border border-border/30 bg-muted/20 px-3 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-muted-foreground bg-muted">
                  {i + 1}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => { setEditingBlock(block); setEditorOpen(true); }}
                    disabled={isDeleted}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(block)}
                    disabled={isDeleted}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
