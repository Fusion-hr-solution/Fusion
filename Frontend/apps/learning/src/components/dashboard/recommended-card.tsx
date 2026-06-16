import Link from "next/link";
import { Clock, BookOpen, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import type { RecommendedCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG } from "@/data/categories";

export function RecommendedCard({ training }: RecommendedCardProps) {
  const category = CATEGORY_CONFIG[training.category];

  return (
    <Link
      href={`/training/${training.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
    <Card className="relative flex flex-col overflow-hidden border border-border/60 bg-white transition-all duration-300 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1">
      <div className={`h-1 w-full ey-animate-stripe ${category.stripClass}`} />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
          >
            {category.label}
          </span>
          <ArrowUpRight
            className="h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-300 group-hover:text-[hsl(var(--ey-blue-600))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </div>

        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
          {training.title}
        </h3>

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
            {training.chaptersCount} chapters
          </span>
          <span className="flex items-center gap-1 font-semibold text-foreground">
            ★ {training.rating}
          </span>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
