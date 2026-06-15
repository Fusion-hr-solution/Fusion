"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExamSectionProps } from "@/types/component-props";
import { ExamCard } from "../exam-card";

export function ExamSection({ exam, chaptersCount }: ExamSectionProps) {
  const t = useTranslations("trainingDetail.exam");
  return (
    <section
      className="ey-animate-fade-up"
      style={{ animationDelay: "300ms" }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <CheckCircle2
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          {t("sectionTitle")}
        </h2>
      </div>

      {exam ? (
        <ExamCard exam={exam} chaptersCount={chaptersCount} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("noExam")}
          </p>
        </div>
      )}
    </section>
  );
}
