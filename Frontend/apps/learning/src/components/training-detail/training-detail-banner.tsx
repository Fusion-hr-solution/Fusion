import Link from "next/link";
import { ArrowLeft, AlertTriangle, Award } from "lucide-react";
import type { Training } from "@/types";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { BADGE_LEVEL_CONFIG } from "@/data/badge-config";

export function TrainingDetailBanner({ training }: { training: Training }) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const badge = BADGE_LEVEL_CONFIG[training.badgeLevel];

  return (
    <div className="relative overflow-hidden bg-white border-b border-border/50">
      <div
        className={`absolute inset-x-0 top-0 h-1 ey-animate-stripe ${category.stripClass}`}
      />
      {/* Subtle geometric accents */}
      <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[hsl(var(--ey-yellow))]/4 to-transparent" />
      <div className="ey-hero-pattern absolute inset-0 opacity-30" />
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-2 border-[hsl(var(--ey-yellow))]/8" />

      <div className="relative mx-auto max-w-5xl px-6 pt-6 pb-10 lg:px-8">
        {/* Breadcrumb */}
        <nav className="ey-animate-fade-in mb-6" aria-label="Breadcrumb">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground group"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            Back to Catalog
          </Link>
        </nav>

        {/* Category + Level + Mandatory + Badge */}
        <div
          className="ey-animate-fade-in flex items-center gap-3 mb-4 flex-wrap"
          style={{ animationDelay: "50ms" }}
        >
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase ${category.badgeClass}`}
          >
            {category.label}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${level.dotClass}`}
            />
            {level.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
            <Award className="h-3 w-3" aria-hidden="true" />
            {badge.label}
          </span>
          {training.isMandatory && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ey-red-500))]/10 border border-[hsl(var(--ey-red-500))]/20 px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ey-red-500))]">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Mandatory
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          className="ey-animate-fade-up text-2xl font-extrabold leading-tight text-foreground sm:text-3xl lg:text-4xl max-w-3xl"
          style={{ animationDelay: "100ms" }}
        >
          {training.title}
        </h1>

        {/* Yellow accent bar */}
        <div
          className="ey-animate-stripe mt-4 h-1 w-20 rounded-full bg-[hsl(var(--ey-yellow))]"
          style={{ animationDelay: "200ms" }}
        />

        {/* Description */}
        <p
          className="ey-animate-fade-up mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base"
          style={{ animationDelay: "150ms" }}
        >
          {training.description}
        </p>
      </div>
    </div>
  );
}
