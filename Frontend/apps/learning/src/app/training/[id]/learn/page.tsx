"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@repo/api/react";
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

  const shouldRedirect = !isLoading && (!!error || !learnData || learnData.chapters.length === 0);

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(`/training/${encodeURIComponent(id)}`);
    }
  }, [shouldRedirect, id, router]);

  if (isLoading || shouldRedirect) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  return <CoursePlayer learnData={learnData!} />;
}