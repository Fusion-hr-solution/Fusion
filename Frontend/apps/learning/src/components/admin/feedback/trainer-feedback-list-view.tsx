"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
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
import { useTrainerFeedbackList } from "@/hooks/use-admin-feedback";

export function TrainerFeedbackListView() {
  const t = useTranslations("adminFeedback");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useTrainerFeedbackList();

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref="/admin/feedback"
        backLabel={tCommon("actions.back")}
        items={[
          { label: t("overview.title"), href: "/admin/feedback" },
          { label: t("trainer.listTitle") },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("trainer.listTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("trainer.listSubtitle")}</p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          {t("trainer.noTrainers")}
        </p>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("trainer.colName")}</TableHead>
                <TableHead className="text-right">{t("trainer.colSessions")}</TableHead>
                <TableHead className="text-right">{t("trainer.colFeedback")}</TableHead>
                <TableHead className="text-right">{t("trainer.colAvg")}</TableHead>
                <TableHead className="text-right">{t("trainer.colRecommend")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tr) => (
                <TableRow key={tr.trainerKey}>
                  <TableCell>
                    <Link
                      href={`/admin/feedback/trainers/${encodeURIComponent(tr.trainerKey)}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {tr.trainerName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{tr.sessionsCount}</TableCell>
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
                  <TableCell className="text-right tabular-nums">{tr.recommendationRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
