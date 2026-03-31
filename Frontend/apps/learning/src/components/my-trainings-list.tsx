"use client";

import { useState, useMemo } from "react";
import { BookOpen, GraduationCap, Clock, CheckCircle2 } from "lucide-react";
import type { TrainingStatus, EnrolledTraining } from "@/types";
import type { MyTrainingsListProps } from "@/types/component-props";
import { TrainingStatusTabs } from "./training-status-tabs";
import { PageHeader } from "./page-header";
import { StatCard } from "./stat-card";
import { EmptyState } from "./empty-state";
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
    { icon: BookOpen, value: inProgress, label: "In Progress" },
    { icon: CheckCircle2, value: completed, label: "Completed" },
    { icon: Clock, value: `${totalHours}h`, label: "Total Hours" },
    { icon: GraduationCap, value: trainings.length, label: "Enrolled" },
  ];

  return (
    <>
      <PageHeader
        moduleTitle="My Learning"
        title="My Trainings"
        description="Track your enrolled trainings, pick up where you left off, and celebrate your completed courses."
      >
        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
          {stats.map((stat, i) => (
            <StatCard
              key={stat.label}
              icon={stat.icon}
              value={stat.value}
              label={stat.label}
              index={i}
            />
          ))}
        </div>
      </PageHeader>

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
            <EmptyState
              icon={GraduationCap}
              title="No trainings in this category yet"
              subtitle="Browse the catalog to discover new trainings."
            />
          )}
        </div>
      </section>
    </>
  );
}
