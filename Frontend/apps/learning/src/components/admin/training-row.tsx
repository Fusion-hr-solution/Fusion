import Link from "next/link";
import { Pencil, Eye, Trash2, BookOpen, Users, AlertTriangle, Monitor, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants, Badge, TableRow, TableCell } from "@repo/ui";
import type { TrainingRowProps } from "@/types/admin-props";

export function TrainingRow({
  training,
  isDeleting,
  viewHref,
  editHref,
  onDelete,
}: TrainingRowProps) {
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");
  return (
    <TableRow className={training.isDeleted ? "opacity-50" : ""}>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground line-clamp-1">{training.title}</span>
          {training.isMandatory && (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
              {t("badge.mandatory")}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{training.categoryName}</TableCell>
      <TableCell className="text-center">
        {training.trainingType === "OnSite" ? (
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">
            <MapPin className="mr-1 h-3 w-3" /> {tCommon("trainingType.OnSiteShort")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-500/5">
            <Monitor className="mr-1 h-3 w-3" /> {tCommon("trainingType.ELearning")}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          {training.trainingType === "OnSite"
            ? t("row.coursesCount", { count: training.chapterCount })
            : t("row.chaptersShort", { count: training.chapterCount })}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {training.enrollmentCount}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs capitalize">
          {tCommon(`badgeLevel.${training.badgeLevel.toLowerCase()}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {training.isDeleted ? (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {t("badge.deleted")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-[hsl(var(--ey-green-500))]/30 text-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))]/5">
            {t("badge.active")}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Link href={viewHref} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`View ${training.title}`}>
            <Eye className="h-3.5 w-3.5" />
          </Link>
          {!training.isDeleted ? (
            <Link href={editHref} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Edit ${training.title}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className={buttonVariants({ variant: "ghost", size: "sm" }) + " pointer-events-none opacity-50"} aria-disabled>
              <Pencil className="h-3.5 w-3.5" />
            </span>
          )}
          <button
            onClick={onDelete}
            disabled={isDeleting || training.isDeleted}
            aria-label={`Delete ${training.title}`}
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-destructive hover:text-destructive hover:bg-destructive/10"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}
