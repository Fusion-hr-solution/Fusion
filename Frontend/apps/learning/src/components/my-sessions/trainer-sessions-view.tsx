"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarClock, CheckCircle2, MapPin } from "lucide-react";
import { Badge, Button, Skeleton } from "@repo/ui";
import type { TrainerSession } from "@/types";
import { TrainerGroupFeedbackDialog } from "./trainer-group-feedback-dialog";

interface TrainerSessionsViewProps {
  sessions: TrainerSession[];
  isLoading: boolean;
  refetch: () => void;
}

export function TrainerSessionsView({ sessions, isLoading, refetch }: TrainerSessionsViewProps) {
  const t = useTranslations("trainerFeedback");
  const format = useFormatter();
  const [active, setActive] = useState<TrainerSession | null>(null);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        {t("noSessions")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <div
          key={s.sessionId}
          className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{s.trainingTitle}</p>
            <p className="truncate text-xs text-muted-foreground">{s.partTitle}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                {format.dateTime(new Date(s.startUtc), { dateStyle: "medium", timeStyle: "short" })}
              </span>
              {s.room ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {s.room}
                </span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0">
            {s.hasGroupFeedback ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
                {t("submitted")}
              </Badge>
            ) : s.status === "Completed" ? (
              <Button size="sm" onClick={() => setActive(s)}>
                {t("giveFeedback")}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">{t("notYetHeld")}</span>
            )}
          </div>
        </div>
      ))}

      {active ? (
        <TrainerGroupFeedbackDialog
          session={active}
          open={!!active}
          onOpenChange={(o) => {
            if (!o) setActive(null);
          }}
          onSubmitted={refetch}
        />
      ) : null}
    </div>
  );
}
