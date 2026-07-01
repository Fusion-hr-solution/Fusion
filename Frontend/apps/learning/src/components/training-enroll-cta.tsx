"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { ChevronRight, Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEnroll } from "@/hooks/use-enroll";
import { getEnrollmentStatus } from "@/services/learning-service";

export function TrainingEnrollCta({ trainingId, trainingType }: { trainingId: string; trainingType: string }) {
  const t = useTranslations("trainingDetail.enroll");
  const router = useRouter();
  const { handleEnroll, isLoading, enrolled } = useEnroll(trainingId);

  const fetchEnrollment = useCallback(() => getEnrollmentStatus(trainingId), [trainingId]);
  const { data: enrollment, isLoading: checkingEnrollment } = useApiQuery(fetchEnrollment);

  const isEnrolled = enrolled || !!enrollment;

  const handleContinueLearning = () => {
    router.push(`/training/${encodeURIComponent(trainingId)}/learn`);
  };

  if (checkingEnrollment) {
    return <Button disabled className="w-full h-12 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /></Button>;
  }

  if (isEnrolled) {
    return (
      <Button onClick={handleContinueLearning} className="w-full bg-[hsl(var(--ey-green-500))] hover:bg-[hsl(var(--ey-green-500))]/90 text-white gap-2 shadow-lg transition-all hover:shadow-xl hover:gap-3 h-12 text-sm font-semibold">
        <Play className="h-4 w-4" aria-hidden="true" />
        {trainingType === "OnSite" ? t("accessCourses") : t("continueLearning")}
        <ChevronRight className="h-4 w-4 transition-transform" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button onClick={() => handleEnroll()} disabled={isLoading} className="w-full ey-bg-dark hover:ey-bg-dark-deep text-white gap-2 shadow-lg transition-all hover:shadow-xl hover:gap-3 h-12 text-sm font-semibold">
      {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("enrolling")}</>) : (<>{t("enrollNow")} <ChevronRight className="h-4 w-4 transition-transform" aria-hidden="true" /></>)}
    </Button>
  );
}
