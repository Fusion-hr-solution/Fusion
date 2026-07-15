"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import { MapPin, User2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button,
  Skeleton,
  Label,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getGrades, getServiceLines } from "@/services/admin-config-service";
import { useAdminPlanning } from "@/hooks/use-admin-planning";
import { formatSessionDate, formatSessionTimeRange } from "@/lib/session-helpers";
import type { AdminGrade, AdminServiceLine } from "@/types/admin";
import type {
  AdminPlanningEventDto,
  AdminPlanningFilters,
  SessionStatus,
} from "@/types/calendar";

const ALL = "all";
const STATUSES: SessionStatus[] = ["Planned", "InProgress", "Completed", "Cancelled"];

function statusClass(status: SessionStatus): string {
  if (status === "InProgress") return "ey-ev-inprogress";
  if (status === "Completed") return "ey-ev-completed";
  if (status === "Cancelled") return "ey-ev-cancelled";
  return "ey-ev-planned";
}

export function PlanningCalendar() {
  const t = useTranslations("calendar.planning");
  const locale = useLocale();
  const intlLocale = locale === "fr" ? "fr-FR" : "en-US";

  const range = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const to = new Date(now);
    to.setDate(to.getDate() + 120);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const [serviceLineId, setServiceLineId] = useState(ALL);
  const [gradeId, setGradeId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [room, setRoom] = useState("");

  const filters: AdminPlanningFilters = useMemo(
    () => ({
      fromUtc: range.from,
      toUtc: range.to,
      serviceLineId: serviceLineId === ALL ? undefined : serviceLineId,
      gradeId: gradeId === ALL ? undefined : gradeId,
      status: status === ALL ? undefined : status,
      room: room.trim() || undefined,
    }),
    [range, serviceLineId, gradeId, status, room],
  );

  const { data: grades } = useApiQuery<AdminGrade[]>(getGrades);
  const { data: serviceLines } = useApiQuery<AdminServiceLine[]>(getServiceLines);
  const { data, isLoading } = useAdminPlanning(filters);
  const [selected, setSelected] = useState<AdminPlanningEventDto | null>(null);

  const hasFilter =
    serviceLineId !== ALL || gradeId !== ALL || status !== ALL || room.trim() !== "";

  const events: EventInput[] = useMemo(
    () =>
      (data ?? []).map((e) => ({
        id: e.id,
        title: `${e.trainingTitle} — ${e.partTitle}`,
        start: e.startUtc,
        end: e.endUtc,
        classNames: [statusClass(e.status)],
        extendedProps: { dto: e },
      })),
    [data],
  );

  function reset() {
    setServiceLineId(ALL);
    setGradeId(ALL);
    setStatus(ALL);
    setRoom("");
  }

  return (
    <section className="space-y-6 px-8 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <FilterSelect
          label={t("filters.serviceLine")}
          value={serviceLineId}
          onChange={setServiceLineId}
          allLabel={t("filters.all")}
          options={(serviceLines ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          label={t("filters.grade")}
          value={gradeId}
          onChange={setGradeId}
          allLabel={t("filters.all")}
          options={(grades ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
        <FilterSelect
          label={t("filters.status")}
          value={status}
          onChange={setStatus}
          allLabel={t("filters.all")}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <div className="space-y-1.5">
          <Label className="text-xs">{t("filters.room")}</Label>
          <Input value={room} onChange={(e) => setRoom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9 text-muted-foreground">
            {t("filters.reset")}
          </Button>
        )}
      </div>

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
              setSelected(arg.event.extendedProps.dto as AdminPlanningEventDto)
            }
          />
        </div>
      )}

      <PlanningDetailDialog
        event={selected}
        intlLocale={intlLocale}
        capacityLabel={(enrolled, max) => t("capacity", { enrolled, max })}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PlanningDetailDialog({
  event,
  intlLocale,
  capacityLabel,
  onClose,
}: {
  event: AdminPlanningEventDto | null;
  intlLocale: string;
  capacityLabel: (enrolled: number, max: number) => string;
  onClose: () => void;
}) {
  if (!event) return null;
  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">
            {event.trainingTitle} — {event.partTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Badge variant="outline">{event.status}</Badge>
          <p className="text-foreground">{formatSessionDate(event.startUtc, intlLocale)}</p>
          <p className="text-muted-foreground">
            {formatSessionTimeRange(event.startUtc, event.endUtc, intlLocale)}
          </p>
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
          <p className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" /> {capacityLabel(event.enrolledCount, event.maxCapacity)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
