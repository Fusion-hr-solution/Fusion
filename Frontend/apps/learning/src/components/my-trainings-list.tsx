"use client";

import { useState, useMemo } from "react";
import { BookOpen, GraduationCap, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import type { TrainingStatus, EnrolledTraining } from "@/types";
import type { MyTrainingsListProps } from "@/types/component-props";
import { TrainingStatusTabs } from "./training-status-tabs";
import { PageHeader } from "./page-header";
import { StatCard } from "./stat-card";
import { EmptyState } from "./empty-state";
import { EnrolledTrainingCard } from "./enrolled-training-card";
import { SearchInput } from "./search-input";

export function MyTrainingsList({ trainings }: MyTrainingsListProps) {
  const [activeTab, setActiveTab] = useState<TrainingStatus | "all">("all");
  const [search, setSearch] = useState("");

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
    let result = trainings;
    if (activeTab !== "all") result = result.filter((t) => t.status === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [trainings, activeTab, search]);

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
        <Card className="border-border/60">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search trainings..."
                ariaLabel="Search enrolled trainings"
              />
            </div>
            <TrainingStatusTabs
              activeTab={activeTab}
              counts={counts}
              onChange={setActiveTab}
            />
          </CardContent>
        </Card>

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
