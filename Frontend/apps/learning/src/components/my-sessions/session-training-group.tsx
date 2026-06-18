"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { MyEnrollmentSummary } from "@/types";
import { SessionTimelineCard } from "./session-timeline-card";

interface SessionTrainingGroupProps {
  training: MyEnrollmentSummary;
}

export function SessionTrainingGroup({ training }: SessionTrainingGroupProps) {
  const t = useTranslations("mySessions");
  const format = useFormatter();
  const nextSession = training.nextSessionUtc
    ? new Date(training.nextSessionUtc)
    : null;

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm">
      {/* Training header */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {training.trainingTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("group.sessionsBooked", { count: training.totalEnrolledParts })}
              {nextSession && (
                <span className="ml-2 text-primary">
                  {t("group.nextSession", {
                    date: format.dateTime(nextSession, { month: "short", day: "numeric" }),
                  })}
                </span>
              )}
            </p>
          </div>
        </div>
        <Link
          href={`/training/${training.trainingId}`}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t("group.viewTraining")} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Sessions list */}
      <CardContent className="p-4">
        <div className="space-y-3">
          {training.sessions.map((session, idx) => (
            <SessionTimelineCard
              key={session.enrollmentId}
              session={session}
              isLast={idx === training.sessions.length - 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
