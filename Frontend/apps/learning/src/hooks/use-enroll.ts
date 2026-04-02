"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { enrollInTraining } from "@/services/learning-service";

export function useEnroll(trainingId: string) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(false);

  const { mutate, isLoading } = useApiMutation(
    () => enrollInTraining(trainingId),
    {
      onSuccess: () => {
        setEnrolled(true);
        router.push(`/training/${encodeURIComponent(trainingId)}/learn`);
      },
      onError: (error) => {
        // 409 = already enrolled — treat as success and redirect to learn page
        if (error instanceof ApiError && error.status === 409) {
          setEnrolled(true);
          router.push(`/training/${encodeURIComponent(trainingId)}/learn`);
        }
      },
    },
  );

  const handleEnroll = useCallback(() => {
    if (!isLoading) {
      mutate(undefined);
    }
  }, [isLoading, mutate]);

  return { handleEnroll, isLoading, enrolled };
}
