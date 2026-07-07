import Link from "next/link";
import { Clock, BookOpen, ArrowUpRight, Sparkles, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@repo/ui";
import type { RecommendedCardProps } from "@/types/component-props";
import type { RecommendationReasonKind } from "@/types";
import { CATEGORY_CONFIG } from "@/data/categories";

const REASON_ICON: Record<RecommendationReasonKind, LucideIcon> = {
  curriculum: Target,
  mandatory: Target,
  similarity: Sparkles,
  rating: TrendingUp,
};

export function RecommendedCard({ training, reason, prose }: RecommendedCardProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const category = CATEGORY_CONFIG[training.category];

  const ReasonIcon = reason ? REASON_ICON[reason.kind] : null;
  let reasonText: string | null = null;
  if (reason) {
    if (reason.kind === "curriculum") reasonText = t("reason.curriculum");
    else if (reason.kind === "mandatory") reasonText = t("reason.mandatory");
    else if (reason.kind === "similarity")
      reasonText = reason.sourceTitle
        ? t("reason.similarity", { source: reason.sourceTitle })
        : t("reason.similarityGeneric");
    else reasonText = t("reason.rating");
  }
  // R6: the generated 'why this' prose replaces the template reason once it arrives
  // (progressive swap); the template is the instant/fallback text.
  if (prose) reasonText = prose;

  return (
    <Link
      href={`/training/${training.id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="group relative flex h-full flex-col overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1 cursor-pointer">
        <div
          className={`h-1 w-full ey-animate-stripe ${category.stripClass}`}
        />
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
            >
              {tCommon(`category.${training.category}`)}
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-300 group-hover:text-[hsl(var(--ey-blue-600))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </div>

          <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
            {training.title}
          </h3>

          {reasonText && ReasonIcon && (
            <div className="flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
              <ReasonIcon
                className="mt-0.5 h-3 w-3 shrink-0 text-[hsl(var(--ey-blue-600))]"
                aria-hidden="true"
              />
              <span className="line-clamp-2">{reasonText}</span>
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 flex-1">
            {training.description}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {training.duration}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {t("chaptersCount", { count: training.chaptersCount })}
            </span>
            {training.rating != null ? (
              <span className="flex items-center gap-1 font-semibold text-foreground">
                ★ {training.rating.toFixed(1)}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {tCommon("noRatings")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
