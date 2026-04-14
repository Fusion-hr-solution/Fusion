"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import { GraduationCap } from "lucide-react";
import { getMyTrainings } from "@/services/learning-service";
import { MyTrainingsList } from "./my-trainings-list";
import { EmptyState } from "./empty-state";

export function MyTrainingsPage() {
  const fetchMyTrainings = useCallback(
    () => getMyTrainings(),
    [],
  );

  const { data: trainings, isLoading, error } = useApiQuery(
    fetchMyTrainings,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your trainings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-12">
        <EmptyState
          icon={GraduationCap}
          title="Unable to load trainings"
          subtitle="Please sign in or try again later."
        />
      </div>
    );
  }

  return <MyTrainingsList trainings={trainings ?? []} />;
}
