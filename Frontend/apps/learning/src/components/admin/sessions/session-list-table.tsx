"use client";

import Link from "next/link";
import { Calendar, MapPin, Users, User, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@repo/ui";
import type { AdminSessionListItem } from "@/types/admin";
import { SessionStatusBadge } from "./session-status-badge";
import {
  formatSessionDate,
  formatSessionTimeRange,
  isCapacityWarning,
} from "@/lib/session-helpers";

interface SessionListTableProps {
  sessions: AdminSessionListItem[];
  emptyMessage?: string;
}

export function SessionListTable({
  sessions,
  emptyMessage,
}: SessionListTableProps) {
  const t = useTranslations("adminSessions");
  const locale = useLocale();
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
          <Calendar className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">
          {t("table.emptyTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {emptyMessage ?? t("table.emptyDefault")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold">
              {t("table.training")}
            </TableHead>
            <TableHead className="font-semibold">{t("table.part")}</TableHead>
            <TableHead className="font-semibold">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {t("table.dateTime")}
              </span>
            </TableHead>
            <TableHead className="font-semibold">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {t("table.room")}
              </span>
            </TableHead>
            <TableHead className="font-semibold">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {t("table.trainer")}
              </span>
            </TableHead>
            <TableHead className="font-semibold text-right">
              <span className="flex items-center justify-end gap-1.5">
                <Users className="h-3.5 w-3.5" /> {t("table.capacity")}
              </span>
            </TableHead>
            <TableHead className="font-semibold">{t("table.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => {
            const warn = isCapacityWarning(s.enrolledCount, s.maxCapacity);
            const ratio =
              s.maxCapacity > 0
                ? Math.round((s.enrolledCount / s.maxCapacity) * 100)
                : 0;
            return (
              <TableRow
                key={s.id}
                className="group transition-colors hover:bg-muted/30"
              >
                <TableCell>
                  <Link
                    href={`/admin/sessions/${s.id}`}
                    className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-[hsl(var(--learning-blue-500))] transition-colors"
                  >
                    {s.trainingTitle}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {s.partTitle}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p className="font-medium">
                      {formatSessionDate(s.startUtc, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatSessionTimeRange(s.startUtc, s.endUtc, locale)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{s.room}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.trainerName ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-sm font-medium ${warn ? "text-[hsl(var(--ey-orange-500))]" : "text-foreground"}`}
                    >
                      {s.enrolledCount}/{s.maxCapacity}
                    </span>
                    <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${warn ? "bg-[hsl(var(--ey-orange-500))]" : "bg-[hsl(var(--ey-green-500))]"}`}
                        style={{ width: `${Math.min(100, ratio)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <SessionStatusBadge status={s.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
