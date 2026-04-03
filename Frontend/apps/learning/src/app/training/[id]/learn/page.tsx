"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { CoursePlayer } from "@/components/learn";
import { getTrainingProgress } from "@/services/learning-service";

interface LearnPageProps {
  params: Promise<{ id: string }>;
}

export default function LearnPage({ params }: LearnPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: learnData, isLoading, error, refetch } = useApiQuery(
    () => getTrainingProgress(id),
  );

  // Only redirect when the user is definitively not enrolled (404)
  const notEnrolled =
    !isLoading && error instanceof ApiError && error.status === 404;

  useEffect(() => {
    if (notEnrolled) {
      router.replace(`/training/${encodeURIComponent(id)}`);
    }
  }, [notEnrolled, id, router]);

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

  // Non-404 error (network failure, 500, backend not restarted, etc.)
  if (error || !learnData) {
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

  return <CoursePlayer learnData={learnData} />;
}