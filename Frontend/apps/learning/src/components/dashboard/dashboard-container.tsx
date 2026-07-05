"use client";

import { useCallback } from "react";
import { Skeleton } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getMyTrainings, getRecommendations } from "@/services/learning-service";
import { Dashboard } from "./dashboard";

const RECOMMENDATION_COUNT = 4;

function DashboardSkeleton() {
  return (
    <div className="space-y-6 px-8 py-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[120px] rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Fetches the signed-in learner's real enrolled trainings and their personalised
 * recommendations, and renders the dashboard from live data — no mock fallback. On
 * failure it shows an honest error state rather than fabricated content. Recommendations
 * are best-effort: they never gate the dashboard, and the rail hides if the AI service
 * is unavailable (design principle #10 — AI is never on the critical path).
 */
export function DashboardContainer() {
  const fetchEnrolled = useCallback(() => getMyTrainings(), []);
  const fetchRecommendations = useCallback(
    () => getRecommendations(RECOMMENDATION_COUNT),
    [],
  );

  const { data: enrolled, isLoading: loadingEnrolled } = useApiQuery(fetchEnrolled);
  const { data: recommendations } = useApiQuery(fetchRecommendations);

  if (loadingEnrolled) {
    return <DashboardSkeleton />;
  }

  if (!enrolled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-semibold text-foreground">We couldn&apos;t load your dashboard</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The learning service is unavailable right now. Refresh the page to try again.
        </p>
      </div>
    );
  }

  return (
    <Dashboard
      enrolledTrainings={enrolled}
      recommendations={recommendations ?? []}
    />
  );
}
