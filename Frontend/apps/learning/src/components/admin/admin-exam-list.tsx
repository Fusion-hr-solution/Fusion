"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ClipboardList, Plus, Pencil } from "lucide-react";
import { Card, CardContent, buttonVariants } from "@repo/ui";
import type { AdminExam } from "@/types/admin";

interface AdminExamListProps {
  trainingId: string;
  exams: AdminExam[];
  isDeleted?: boolean;
}

export function AdminExamList({
  trainingId,
  exams,
  isDeleted,
}: AdminExamListProps) {
  const t = useTranslations("adminExam");
  const hasExam = exams.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {t("list.heading")}
        </h2>
        {!isDeleted && (
          <Link
            href={`/admin/trainings/${trainingId}/exam`}
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "ey-bg-dark hover:opacity-90",
            })}
          >
            {hasExam ? (
              <>
                <Pencil className="mr-1.5 h-4 w-4" />
                {t("list.manageExam")}
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("list.addExam")}
              </>
            )}
          </Link>
        )}
      </div>

      {hasExam ? (
        exams.map((exam) => (
          <Card key={exam.id} className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {exam.title}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {t("list.questionsCount", { count: exam.questionCount })}
                    </span>
                    <span>{t("list.pass", { score: exam.passingScore })}</span>
                  </div>
                </div>
              </div>
              {!isDeleted && (
                <Link
                  href={`/admin/trainings/${trainingId}/exam`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  {t("list.edit")}
                </Link>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t("list.emptyTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {t("list.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
