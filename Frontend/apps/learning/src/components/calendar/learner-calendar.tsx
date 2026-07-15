"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import { CalendarPlus, MapPin, User2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button,
  Skeleton,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useMyCalendar } from "@/hooks/use-my-calendar";
import { formatSessionDate, formatSessionTimeRange } from "@/lib/session-helpers";
import type { CalendarEventDto } from "@/types/calendar";
import { SubscribeDialog } from "./subscribe-dialog";

function eventClass(e: CalendarEventDto): string[] {
  const classes: string[] = [];
  if (e.kind === "deadline") classes.push("ey-ev-deadline");
  else if (e.sessionStatus === "InProgress") classes.push("ey-ev-inprogress");
  else if (e.sessionStatus === "Completed") classes.push("ey-ev-completed");
  else classes.push("ey-ev-planned");
  if (e.isWaitlisted) classes.push("ey-ev-waitlisted");
  return classes;
}

export function LearnerCalendar() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const intlLocale = locale === "fr" ? "fr-FR" : "en-US";

  // Fixed wide window, computed once so the data fetch is stable.
  const range = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const to = new Date(now);
    to.setDate(to.getDate() + 180);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data, isLoading } = useMyCalendar(range.from, range.to);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarEventDto | null>(null);

  const events: EventInput[] = useMemo(
    () =>
      (data ?? []).map((e) => ({
        id: `${e.kind}-${e.id}`,
        title: e.title,
        start: e.startUtc,
        end: e.allDay ? undefined : e.endUtc,
        allDay: e.allDay,
        classNames: eventClass(e),
        extendedProps: { dto: e },
      })),
    [data],
  );

  return (
    <section className="space-y-6 px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setSubscribeOpen(true)} className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          {t("subscribe.action")}
        </Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-[640px] rounded-xl" />
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,listWeek",
            }}
            locale={locale === "fr" ? frLocale : "en"}
            firstDay={1}
            height="auto"
            nowIndicator
            dayMaxEvents={3}
            events={events}
            eventClick={(arg: EventClickArg) =>
              setSelected(arg.event.extendedProps.dto as CalendarEventDto)
            }
          />
        </div>
      )}

      <SubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
      <EventDetailDialog
        event={selected}
        intlLocale={intlLocale}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function EventDetailDialog({
  event,
  intlLocale,
  onClose,
}: {
  event: CalendarEventDto | null;
  intlLocale: string;
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  if (!event) return null;

  const isDeadline = event.kind === "deadline";

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {isDeadline ? (
              <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                {t("deadlineBadge")}
              </Badge>
            ) : (
              <Badge variant="outline">{event.enrollmentStatus ?? "Enrolled"}</Badge>
            )}
            {event.isWaitlisted && (
              <Badge variant="outline" className="text-muted-foreground">
                {t("waitlistedBadge")}
              </Badge>
            )}
          </div>

          <p className="text-foreground">{formatSessionDate(event.startUtc, intlLocale)}</p>
          {!isDeadline && (
            <p className="text-muted-foreground">
              {formatSessionTimeRange(event.startUtc, event.endUtc, intlLocale)}
            </p>
          )}

          {event.room && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" /> {event.room}
            </p>
          )}
          {event.trainerName && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <User2 className="h-4 w-4" /> {event.trainerName}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
