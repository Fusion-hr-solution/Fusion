"use client";

import { use } from "react";
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

  const { data: learnData, isLoading, error } = useApiQuery(
    () => getTrainingProgress(id),
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error || !learnData || learnData.chapters.length === 0) {
    // Not enrolled or no content — redirect to training detail
    router.replace(`/training/${encodeURIComponent(id)}`);
    return null;
  }

  return <CoursePlayer learnData={learnData} />;
}