"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@repo/api";
import { useApiMutation } from "@repo/api/react";
import { enrollInTraining } from "@/services/learning-service";

export function useEnroll(trainingId: string) {
  const router = useRouter();

  const navigateToLearn = useCallback(() => {
    router.push(`/training/${encodeURIComponent(trainingId)}/learn`);
  }, [router, trainingId]);

  const { mutate, isLoading, data } = useApiMutation(
    () => enrollInTraining(trainingId),
    {
      onSuccess: navigateToLearn,
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          navigateToLearn();
        }
      },
    },
  );

  return { handleEnroll: mutate, isLoading, enrolled: !!data };
}
