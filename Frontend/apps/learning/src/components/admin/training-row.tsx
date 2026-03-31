import { Pencil, Eye, Trash2, BookOpen, Users, AlertTriangle } from "lucide-react";
import { Button, Badge } from "@repo/ui";
import type { TrainingRowProps } from "@/types/admin-props";

export function TrainingRow({
  training,
  isDeleting,
  onView,
  onEdit,
  onDelete,
}: TrainingRowProps) {
  return (
    <tr className={`border-b border-border/30 transition-colors hover:bg-[hsl(var(--ey-grey-100))]/30 ${training.isDeleted ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground line-clamp-1">{training.title}</span>
          {training.isMandatory && (
            <Badge variant="outline" className="text-[10px] border-[hsl(var(--ey-red-500))]/30 text-[hsl(var(--ey-red-500))]">
              Mandatory
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{training.categoryName}</td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          {training.chapterCount}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {training.enrollmentCount}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <Badge variant="outline" className="text-xs capitalize">
          {training.badgeLevel}
        </Badge>
      </td>
      <td className="px-4 py-3 text-center">
        {training.isDeleted ? (
          <Badge variant="outline" className="text-[10px] border-[hsl(var(--ey-red-500))]/30 text-[hsl(var(--ey-red-500))] bg-[hsl(var(--ey-red-500))]/5">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Deleted
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-[hsl(var(--ey-green-500))]/30 text-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))]/5">
            Active
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={onView} aria-label={`View ${training.title}`}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={training.isDeleted} aria-label={`Edit ${training.title}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting || training.isDeleted}
            aria-label={`Delete ${training.title}`}
            className="text-[hsl(var(--ey-red-500))] hover:text-[hsl(var(--ey-red-500))] hover:bg-[hsl(var(--ey-red-500))]/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
