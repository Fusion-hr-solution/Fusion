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
  const isOnSite = training.trainingType === "OnSite";
  const TypeIcon = isOnSite ? MapPin : Monitor;
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");

  return (
    <TableRow
      className={`group border-border/60 transition-colors hover:bg-muted/40 ${training.isDeleted ? "opacity-50" : ""}`}
    >
      {/* Training — icon chip + title + category subtitle */}
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-background">
            <TypeIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="line-clamp-1 font-semibold text-foreground">{training.title}</span>
              {training.isMandatory && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-[hsl(var(--ey-orange-500))]/30 bg-[hsl(var(--ey-orange-500))]/10 text-[10px] text-[hsl(var(--ey-orange-500))]"
                >
                  {t("badge.mandatory")}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{training.categoryName}</span>
          </div>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell className="text-center">
        {isOnSite ? (
          <Badge
            variant="outline"
            className="border-[hsl(var(--ey-teal-500))]/30 bg-[hsl(var(--ey-teal-500))]/10 text-[10px] text-[hsl(var(--ey-teal-500))]"
          >
            <MapPin className="mr-1 h-3 w-3" /> {tCommon("trainingType.OnSiteShort")}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-[hsl(var(--ey-blue-400))]/30 bg-[hsl(var(--ey-blue-400))]/10 text-[10px] text-[hsl(var(--ey-blue-600))]"
          >
            <Monitor className="mr-1 h-3 w-3" /> {tCommon("trainingType.ELearning")}
          </Badge>
        )}
      </TableCell>

      {/* Content */}
      <TableCell className="text-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {isOnSite
            ? t("row.coursesCount", { count: training.chapterCount })
            : t("row.chaptersShort", { count: training.chapterCount })}
        </span>
      </TableCell>

      {/* Enrolled */}
      <TableCell className="text-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {training.enrollmentCount}
        </span>
      </TableCell>

      {/* Level */}
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs capitalize">
          {tCommon(`badgeLevel.${training.badgeLevel.toLowerCase()}`)}
        </Badge>
      </TableCell>

      {/* Status */}
      <TableCell className="text-center">
        {training.isDeleted ? (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {t("badge.deleted")}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-[hsl(var(--ey-green-500))]/30 bg-[hsl(var(--ey-green-500))]/10 text-[10px] text-[hsl(var(--ey-green-500))]"
          >
            {t("badge.active")}
          </Badge>
        )}
      </TableCell>

      {/* Actions */}
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
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-destructive hover:bg-destructive/10 hover:text-destructive"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}
