"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@repo/api";
import { enrollInTraining } from "@/services/learning-service";
import { useState } from "react";

export function useEnroll(trainingId: string) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const handleEnroll = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await enrollInTraining(trainingId);
      setEnrolled(true);
    } catch (error) {
      // 409 = already enrolled — treat as success
      if (error instanceof ApiError && error.status === 409) {
        setEnrolled(true);
      } else {
        setIsLoading(false);
        return;
      }
    }

    // Navigate after state updates are flushed
    router.push(`/training/${encodeURIComponent(trainingId)}/learn`);
  }, [isLoading, trainingId, router]);

  return { handleEnroll, isLoading, enrolled };
}
