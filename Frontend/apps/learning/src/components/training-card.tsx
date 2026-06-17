import Link from "next/link";
import { Card, CardContent } from "@repo/ui";
import { Clock, BookOpen, Users, Star, ArrowUpRight, AlertTriangle, Award } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Training } from "@/types";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { BADGE_LEVEL_CONFIG } from "@/data/badge-config";
import { FormatBadge } from "./format-badge";

export function TrainingCard({ training }: { training: Training }) {
  const t = useTranslations("catalog.card");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const badge = BADGE_LEVEL_CONFIG[training.badgeLevel];

  return (
    <Link href={`/training/${training.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
    <Card
      className="group relative flex flex-col overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1 cursor-pointer h-full"
      aria-label={t("viewDetailsAria", { title: training.title })}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Top — category + level + mandatory */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase shrink-0 ${category.badgeClass}`}
            >
              {tCommon(`category.${training.category}`)}
            </span>
            {training.isMandatory && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ey-orange-500))]/10 border border-[hsl(var(--ey-orange-500))]/30 px-2 py-0.5 text-xs font-semibold text-foreground shrink-0">
                <AlertTriangle className="h-3 w-3 text-[hsl(var(--ey-orange-500))]" aria-hidden="true" />
                {t("mandatory")}
              </span>
            )}
            <FormatBadge type={training.trainingType} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${level.dotClass}`} />
              {tCommon(`level.${training.level}`)}
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-300 group-hover:text-[hsl(var(--ey-blue-600))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors duration-200">
          {training.title}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 flex-1">
          {training.description}
        </p>

        {/* Meta row — pill style */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {training.duration}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {training.trainingType === "OnSite"
              ? t("coursesCount", { count: training.onSiteCourses?.length ?? 0 })
              : t("chaptersCount", { count: training.chaptersCount })}
          </span>
          <span className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${badge.className}`}>
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            {tCommon(`badgeLevel.${training.badgeLevel.toLowerCase()}`)}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-semibold">
            {t("credits", { count: training.credits })}
          </span>
        </div>

        {/* Bottom — instructor + stats */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full ey-bg-dark text-xs font-semibold text-white ring-2 ring-border transition-all duration-300 group-hover:ring-[hsl(var(--ey-yellow))]/40">
              {training.instructor
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <span className="text-xs font-medium text-foreground">
              {training.instructor}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 ey-star" aria-hidden="true" />
              <span className="font-semibold text-foreground">{training.rating}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {format.number(training.enrolledCount)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
