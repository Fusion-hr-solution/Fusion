"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, GraduationCap, MessageSquare, Star, ThumbsUp } from "lucide-react";
import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { KpiCard } from "@/components/kpi-card";
import { useTrainerFeedbackDetail } from "@/hooks/use-admin-feedback";
import { FeedbackComments } from "./feedback-comments";

interface TrainerFeedbackDetailViewProps {
  trainerKey: string;
}

export function TrainerFeedbackDetailView({ trainerKey }: TrainerFeedbackDetailViewProps) {
  const t = useTranslations("adminFeedback");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useTrainerFeedbackDetail(trainerKey);

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref="/admin/feedback/trainers"
        backLabel={tCommon("actions.back")}
        items={[
          { label: t("overview.title"), href: "/admin/feedback" },
          { label: t("trainer.listTitle"), href: "/admin/feedback/trainers" },
          { label: data.trainerName },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.trainerName}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard icon={GraduationCap} value={data.avgTrainerRating.toFixed(2)} label={t("trainer.colAvg")} delayBase={0} />
        <KpiCard icon={MessageSquare} value={data.feedbackCount} label={t("trainer.colFeedback")} index={1} delayBase={0} />
        <KpiCard icon={CalendarClock} value={data.sessionsCount} label={t("trainer.colSessions")} index={2} delayBase={0} />
        <KpiCard icon={ThumbsUp} value={`${data.recommendationRate}%`} label={t("trainer.colRecommend")} index={3} delayBase={0} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border/60 px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t("trainer.trainings")}</h3>
        </div>
        {data.trainings.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("trainer.noTrainers")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("trainer.colTraining")}</TableHead>
                <TableHead className="text-right">{t("trainer.colFeedback")}</TableHead>
                <TableHead className="text-right">{t("trainer.colAvg")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trainings.map((tr) => (
                <TableRow key={tr.trainingId}>
                  <TableCell className="font-medium text-foreground">{tr.trainingTitle}</TableCell>
                  <TableCell className="text-right tabular-nums">{tr.feedbackCount}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Star
                        className="h-3.5 w-3.5 text-[hsl(var(--ey-yellow))]"
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      {tr.avgTrainerRating.toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <FeedbackComments
        title={t("trainer.comments")}
        comments={data.comments}
        suppressed={false}
        suppressedLabel=""
        emptyLabel={t("trainer.noComments")}
        showTraining
      />
    </div>
  );
}
