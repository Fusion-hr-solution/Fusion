"use client";

import { use, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { CoursePlayer } from "@/components/learn";
import { OnSiteLearnView } from "@/components/learn/onsite-learn-view";
import { getTrainingProgress, getTrainingById } from "@/services/learning-service";

interface LearnPageProps {
  params: Promise<{ id: string }>;
}

export default function LearnPage({ params }: LearnPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const fetchTraining = useCallback(
    () => getTrainingById(id),
    [id],
  );

  const fetchProgress = useCallback(
    () => getTrainingProgress(id),
    [id],
  );

  // Fetch training detail to check type
  const { data: training, isLoading: loadingTraining } = useApiQuery(
    fetchTraining,
  );

  const isOnSite = training?.trainingType === "OnSite";

  // Only fetch progress for e-learning trainings
  const { data: learnData, isLoading: loadingProgress, error, refetch } = useApiQuery(
    fetchProgress,
    { enabled: !loadingTraining && !isOnSite },
  );

  const isLoading = loadingTraining || (!isOnSite && loadingProgress);

  // Only redirect when the user is definitively not enrolled (404)
  const notEnrolled =
    !isLoading && !isOnSite && error instanceof ApiError && error.status === 404;

  useEffect(() => {
    if (notEnrolled) {
      router.replace(`/training/${encodeURIComponent(id)}`);
    }
  }, [notEnrolled, id, router]);

  // Merge exam info from training detail into learn data (progress endpoint omits it)
  const enrichedLearnData = useMemo(() => {
    if (!learnData || !training) return null;
    return {
      ...learnData,
      training: { ...learnData.training, exam: training.exam },
    };
  }, [learnData, training]);

  if (isLoading || notEnrolled) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  // On-site training: show PDF course viewer
  if (isOnSite && training) {
    return <OnSiteLearnView training={training} />;
  }

  // Non-404 error (network failure, 500, backend not restarted, etc.)
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl" aria-hidden="true">!</span>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Failed to load course</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof ApiError
                ? error.message
                : "Unable to connect. Make sure the Training service is running."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refetch}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            <button
              onClick={() => router.replace(`/training/${encodeURIComponent(id)}`)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Data not yet available — keep showing loading spinner
  if (!enrichedLearnData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  return <CoursePlayer learnData={enrichedLearnData} />;
}