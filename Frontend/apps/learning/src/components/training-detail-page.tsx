"use client";

import Link from "next/link";
import {
  Badge,
  Button,
} from "@repo/ui";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  BookOpen,
  Clock,
  Users,
  Star,
  User,
  Play,
  CheckCircle2,
} from "lucide-react";
import type { TrainingDetailPageProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { ExamCard } from "./exam-card";

export function TrainingDetailPage({ training }: TrainingDetailPageProps) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];

  const stats = [
    {
      icon: Clock,
      value: training.duration,
      label: "Total Duration",
      iconClass: "text-[hsl(var(--ey-blue-400))]",
      bgClass: "bg-[hsl(var(--ey-blue-400))]/10",
    },
    {
      icon: BookOpen,
      value: String(training.chaptersCount),
      label: "Chapters",
      iconClass: "text-[hsl(var(--ey-teal-500))]",
      bgClass: "bg-[hsl(var(--ey-teal-500))]/10",
    },
    {
      icon: Users,
      value: training.enrolledCount.toLocaleString(),
      label: "Enrolled",
      iconClass: "text-[hsl(var(--ey-orange-500))]",
      bgClass: "bg-[hsl(var(--ey-orange-500))]/10",
    },
    {
      icon: Star,
      value: String(training.rating),
      label: "Rating",
      iconClass: "ey-star",
      bgClass: "bg-[hsl(var(--ey-yellow))]/10",
    },
  ];

  return (
    <div className="min-h-full">
      {/* ── Top banner with category color ── */}
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

          {/* Category + Level */}
          <div
            className="ey-animate-fade-in flex items-center gap-3 mb-4"
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

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Left column ── */}
          <div className="space-y-8">
            {/* Stats grid */}
            <div
              className="ey-animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-4"
              style={{ animationDelay: "200ms" }}
            >
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-white p-4 text-center transition-all hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bgClass}`}
                    >
                      <Icon
                        className={`h-4 w-4 ${stat.iconClass}`}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {stat.value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stat.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Course content / Chapters */}
            <section
              className="ey-animate-fade-up"
              style={{ animationDelay: "250ms" }}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <BookOpen
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  Course Content
                </h2>
                <span className="rounded-full bg-[hsl(var(--ey-grey-100))] px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {training.chaptersCount} chapters
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/50 bg-white">
                <div className="ey-stagger-list">
                  {training.chapters.map((chapter, i) => (
                    <div
                      key={chapter.id}
                      className={`group/ch flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[hsl(var(--ey-grey-50))] ${
                        i !== training.chapters.length - 1
                          ? "border-b border-border/30"
                          : ""
                      }`}
                    >
                      {/* Chapter number */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--ey-grey-100))] text-sm font-bold text-muted-foreground transition-all group-hover/ch:bg-[hsl(var(--ey-grey-500))] group-hover/ch:text-white">
                        {i + 1}
                      </div>

                      {/* Title & duration */}
                      <div className="flex flex-1 items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {chapter.title}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {chapter.duration}
                          </span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-100))] text-muted-foreground/60 transition-all group-hover/ch:bg-[hsl(var(--ey-yellow))]/20 group-hover/ch:text-[hsl(var(--ey-grey-500))]">
                            <Play
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Exam section */}
            {training.exam ? (
              <section
                className="ey-animate-fade-up"
                style={{ animationDelay: "300ms" }}
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <CheckCircle2
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-bold text-foreground sm:text-lg">
                    Final Assessment
                  </h2>
                </div>
                <ExamCard
                  exam={training.exam}
                  chaptersCount={training.chaptersCount}
                />
              </section>
            ) : (
              <section
                className="ey-animate-fade-up"
                style={{ animationDelay: "300ms" }}
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <CheckCircle2
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-bold text-foreground sm:text-lg">
                    Final Assessment
                  </h2>
                </div>
                <div className="rounded-2xl border border-dashed border-border/60 bg-white px-6 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No exam required for this training. Complete all chapters to
                    earn your certificate.
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* ── Right column / Sidebar ── */}
          <aside className="space-y-6">
            {/* Instructor card */}
            <div
              className="ey-animate-fade-up rounded-2xl border border-border/50 bg-white p-6"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <User
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-bold text-foreground">
                  Instructor
                </h3>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ey-bg-dark text-base font-semibold text-white ring-2 ring-[hsl(var(--ey-grey-200))]">
                  {training.instructor
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {training.instructor}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {training.instructorRole}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div
              className="ey-animate-fade-up rounded-2xl border border-border/50 bg-white p-6"
              style={{ animationDelay: "250ms" }}
            >
              <h3 className="mb-3 text-sm font-bold text-foreground">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {training.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="rounded-full text-xs font-normal transition-colors hover:bg-[hsl(var(--ey-grey-200))]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Updated date */}
            <div
              className="ey-animate-fade-up rounded-2xl border border-border/50 bg-white p-6"
              style={{ animationDelay: "300ms" }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                <span>
                  Last updated{" "}
                  {new Date(
                    training.updatedAt + "T00:00:00"
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div
              className="ey-animate-fade-up sticky top-6"
              style={{ animationDelay: "350ms" }}
            >
              <Button className="w-full ey-bg-dark hover:ey-bg-dark-deep text-white gap-2 shadow-lg transition-all hover:shadow-xl hover:gap-3 h-12 text-sm font-semibold">
                Enroll Now
                <ChevronRight
                  className="h-4 w-4 transition-transform"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
