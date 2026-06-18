"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import { getMyTrainings } from "@/services/learning-service";
import { MyTrainingsList } from "./my-trainings-list";
import { EmptyState } from "./empty-state";

export function MyTrainingsPage() {
  const t = useTranslations("myTrainings");
  const fetchMyTrainings = useCallback(() => getMyTrainings(), []);

  const { data: trainings, isLoading, error } = useApiQuery(fetchMyTrainings);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-12">
        <EmptyState
          icon={GraduationCap}
          title={t("errorTitle")}
          subtitle={t("errorSubtitle")}
        />
      </div>
    );
  }

  return <MyTrainingsList trainings={trainings ?? []} />;
}
