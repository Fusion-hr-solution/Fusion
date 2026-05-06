"use client";

import Link from "next/link";
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

export function SessionListTable({ sessions, emptyMessage = "No sessions found." }: SessionListTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Training</TableHead>
          <TableHead>Part</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Room</TableHead>
          <TableHead>Trainer</TableHead>
          <TableHead className="text-right">Capacity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => {
          const warn = isCapacityWarning(s.enrolledCount, s.maxCapacity);
          return (
            <TableRow key={s.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <Link href={`/admin/sessions/${s.id}`} className="hover:underline">
                  {s.trainingTitle}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{s.partTitle}</TableCell>
              <TableCell>{formatSessionDate(s.startUtc)}</TableCell>
              <TableCell className="font-mono text-xs">{formatSessionTimeRange(s.startUtc, s.endUtc)}</TableCell>
              <TableCell>{s.room}</TableCell>
              <TableCell className="text-muted-foreground">{s.trainerName ?? "—"}</TableCell>
              <TableCell className={`text-right ${warn ? "font-semibold text-[hsl(var(--ey-orange-500))]" : ""}`}>
                {s.enrolledCount}/{s.maxCapacity}
              </TableCell>
              <TableCell>
                <SessionStatusBadge status={s.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
