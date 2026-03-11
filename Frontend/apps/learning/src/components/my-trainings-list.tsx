"use client";

import { useState, useMemo } from "react";
import { BookOpen, GraduationCap, Clock, CheckCircle2 } from "lucide-react";
import type { TrainingStatus, EnrolledTraining } from "@/types";
import type { MyTrainingsListProps } from "@/types/component-props";
import { TrainingStatusTabs } from "./training-status-tabs";
import { EnrolledTrainingCard } from "./enrolled-training-card";

export function MyTrainingsList({ trainings }: MyTrainingsListProps) {
  const [activeTab, setActiveTab] = useState<TrainingStatus | "all">("all");

  const counts = useMemo(() => {
    const c: Record<TrainingStatus | "all", number> = {
      all: trainings.length,
      "in-progress": 0,
      completed: 0,
      "not-started": 0,
    };
    for (const t of trainings) {
      c[t.status]++;
    }
    return c;
  }, [trainings]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return trainings;
    return trainings.filter((t) => t.status === activeTab);
  }, [trainings, activeTab]);

  const inProgress = counts["in-progress"];
  const completed = counts["completed"];
  const totalHours = trainings.reduce((sum, t) => {
    return sum + parseInt(t.duration.replace(/\D/g, ""));
  }, 0);

  const handleContinue = (_training: EnrolledTraining) => {
    // TODO: navigate to training player
  };

  return (
    <>
      {/* Header */}
      <section className="border-b border-border/50 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:py-12">
          <div className="flex items-end gap-3 mb-1">
            <div className="flex h-9 w-1 rounded-full ey-bg-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
              My Learning
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
            My Trainings
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Track your enrolled trainings, pick up where you left off, and
            celebrate your completed courses.
          </p>

          {/* Quick stats */}
          <div className="mt-6 flex flex-wrap gap-6">
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-[hsl(var(--ey-grey-50))] px-4 py-2.5">
              <BookOpen className="h-4 w-4 text-[hsl(var(--ey-blue-400))]" />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">
                  {inProgress}
                </p>
                <p className="text-[11px] text-muted-foreground">In Progress</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-[hsl(var(--ey-grey-50))] px-4 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--ey-green-500))]" />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">
                  {completed}
                </p>
                <p className="text-[11px] text-muted-foreground">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-[hsl(var(--ey-grey-50))] px-4 py-2.5">
              <Clock className="h-4 w-4 text-[hsl(var(--ey-orange-500))]" />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">
                  {totalHours}h
                </p>
                <p className="text-[11px] text-muted-foreground">Total Hours</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-[hsl(var(--ey-grey-50))] px-4 py-2.5">
              <GraduationCap className="h-4 w-4 ey-text-accent" />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">
                  {trainings.length}
                </p>
                <p className="text-[11px] text-muted-foreground">Enrolled</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <TrainingStatusTabs
          activeTab={activeTab}
          counts={counts}
          onChange={setActiveTab}
        />

        <div className="mt-6 space-y-4">
          {filtered.length > 0 ? (
            filtered.map((training) => (
              <EnrolledTrainingCard
                key={training.id}
                training={training}
                onContinue={handleContinue}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-20">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No trainings in this category yet.
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground/70">
                Browse the catalog to discover new trainings.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
