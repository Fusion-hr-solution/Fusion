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

  const stats = [
    {
      icon: BookOpen,
      value: inProgress,
      label: "In Progress",
      iconColor: "text-[hsl(var(--ey-grey-400))]",
      bgAccent: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: CheckCircle2,
      value: completed,
      label: "Completed",
      iconColor: "text-[hsl(var(--ey-grey-400))]",
      bgAccent: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: Clock,
      value: `${totalHours}h`,
      label: "Total Hours",
      iconColor: "text-[hsl(var(--ey-grey-400))]",
      bgAccent: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: GraduationCap,
      value: trainings.length,
      label: "Enrolled",
      iconColor: "text-[hsl(var(--ey-grey-400))]",
      bgAccent: "bg-[hsl(var(--ey-grey-100))]",
    },
  ];

  return (
    <>
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border/50 bg-white">
        <div className="ey-hero-pattern absolute inset-0 opacity-30" />
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[hsl(var(--ey-yellow))]/5 to-transparent" />

        <div className="relative px-8 py-10 lg:py-12">
          <div className="ey-animate-fade-up flex items-end gap-3 mb-1">
            <div className="flex h-9 w-1 rounded-full ey-bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              My Learning
            </span>
          </div>

          <div>
            <div>
              <h1
                className="ey-animate-fade-up mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl"
                style={{ animationDelay: "80ms" }}
              >
                My Trainings
              </h1>
              <p
                className="ey-animate-fade-up mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                Track your enrolled trainings, pick up where you left off, and
                celebrate your completed courses.
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`ey-animate-fade-up flex items-center gap-3 rounded-xl border border-border/60 ${stat.bgAccent} px-4 py-3 transition-all hover:shadow-sm`}
                  style={{ animationDelay: `${200 + i * 60}ms` }}
                >
                  <Icon className={`h-5 w-5 ${stat.iconColor}`} aria-hidden="true" />
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="px-8 py-8">
        <TrainingStatusTabs
          activeTab={activeTab}
          counts={counts}
          onChange={setActiveTab}
        />

        <div className="mt-6 ey-stagger-list space-y-4">
          {filtered.length > 0 ? (
            filtered.map((training) => (
              <EnrolledTrainingCard
                key={training.id}
                training={training}
                onContinue={handleContinue}
              />
            ))
          ) : (
            <div className="ey-animate-scale-in flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-white py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-100))] mb-4">
                <GraduationCap className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No trainings in this category yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Browse the catalog to discover new trainings.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
