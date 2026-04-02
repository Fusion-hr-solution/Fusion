import {
  Pencil,
  Trash2,
  Plus,
  GripVertical,
  Clock,
  FileText,
  Video,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import type { AdminChapter } from "@/types/admin";

interface AdminChapterListProps {
  chapters: AdminChapter[];
  isDeleted: boolean;
  onAddChapter: () => void;
  onEditChapter: (chapter: AdminChapter) => void;
  onDeleteChapter: (chapter: AdminChapter) => void;
}

function contentTypeIcon(type: string) {
  return type === "Video" ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
}

export function AdminChapterList({
  chapters,
  isDeleted,
  onAddChapter,
  onEditChapter,
  onDeleteChapter,
}: AdminChapterListProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Chapters</CardTitle>
        <Button
          size="sm"
          onClick={onAddChapter}
          disabled={isDeleted}
          className="ey-bg-dark hover:opacity-90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Chapter
        </Button>
      </CardHeader>
      <CardContent>
        {chapters.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No chapters yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {[...chapters]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {ch.orderIndex + 1}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {contentTypeIcon(ch.contentType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ch.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize">{ch.contentType}</span>
                      {ch.estimatedDurationMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ch.estimatedDurationMinutes} min
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditChapter(ch)}
                      disabled={isDeleted}
                      aria-label={`Edit ${ch.title}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteChapter(ch)}
                      disabled={isDeleted}
                      aria-label={`Delete ${ch.title}`}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
