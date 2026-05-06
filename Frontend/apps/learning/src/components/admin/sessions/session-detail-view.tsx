"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, AlertTriangle, Pencil, X, Copy } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Progress } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getSessionDetail,
  duplicateSession,
} from "@/services/admin-sessions-service";
import { SessionStatusBadge } from "./session-status-badge";
import { CancelSessionDialog } from "./cancel-session-dialog";
import {
  formatSessionDate,
  formatSessionTimeRange,
} from "@/lib/session-helpers";

interface SessionDetailViewProps {
  sessionId: string;
}

export function SessionDetailView({ sessionId }: SessionDetailViewProps) {
  const fetcher = useCallback(() => getSessionDetail(sessionId), [sessionId]);
  const { data: session, isLoading, refetch } = useApiQuery(fetcher);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [duplicateNew, setDuplicateNew] = useState("");

  const { mutateAsync: doDuplicate, isLoading: dupPending } = useApiMutation(
    () => duplicateSession(sessionId, {
      newStartUtc: new Date(duplicateNew).toISOString(),
      occurrences: 1,
      intervalDays: 7,
    }),
    { onSuccess: () => refetch() },
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!session) return <p className="text-sm text-destructive">Session not found.</p>;

  const ratio = session.maxCapacity > 0
    ? Math.min(100, (session.enrolledCount / session.maxCapacity) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/sessions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{session.trainingTitle}</h1>
        <SessionStatusBadge status={session.status} />
      </div>

      <Card className="border-border/60">
        <CardContent className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Part</p>
              <p className="font-medium">{session.partTitle}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{formatSessionDate(session.startUtc)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="font-mono text-sm">{formatSessionTimeRange(session.startUtc, session.endUtc)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Room</p>
              <p className="font-medium">{session.room}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trainer</p>
              <p className="font-medium">{session.trainerName ?? "—"}</p>
              {session.trainerEmail && (
                <p className="text-xs text-muted-foreground">{session.trainerEmail}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className={`font-medium ${session.capacityWarning ? "text-[hsl(var(--ey-orange-500))]" : ""}`}>
                {session.enrolledCount}/{session.maxCapacity}
              </p>
              <Progress value={ratio} className="mt-1.5 h-1.5" />
            </div>
          </div>

          {session.capacityWarning && (
            <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--ey-yellow))]/40 bg-[hsl(var(--ey-yellow))]/10 px-3 py-2 text-xs text-[hsl(var(--ey-orange-500))]">
              <AlertTriangle className="h-3.5 w-3.5" />
              Capacity is at or above 90%.
            </div>
          )}

          {session.notes && (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{session.notes}</p>
            </div>
          )}

          {session.status === "Cancelled" && session.cancelReason && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span className="font-medium">Cancelled:</span> {session.cancelReason}
            </div>
          )}

          {session.status !== "Cancelled" && (
            <div className="flex items-center gap-2 pt-2">
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                <X className="mr-1.5 h-4 w-4" /> Cancel Session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-3 py-4">
          <h2 className="text-sm font-semibold">Duplicate Session</h2>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="dupStart">New start (local)</Label>
              <Input id="dupStart" type="datetime-local" value={duplicateNew} onChange={(e) => setDuplicateNew(e.target.value)} />
            </div>
            <Button onClick={() => doDuplicate()} disabled={!duplicateNew || dupPending} size="sm">
              <Copy className="mr-1.5 h-4 w-4" />
              {dupPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-3 py-4">
          <h2 className="text-sm font-semibold">Enrolled Employees ({session.attendees.length})</h2>
          {session.attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrolled employees yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {session.attendees.map((a) => (
                <li key={a.employeeId} className="flex justify-between border-b border-border/40 py-1">
                  <span>{a.fullName ?? a.employeeId}</span>
                  <span className="text-muted-foreground">{a.email ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CancelSessionDialog
        sessionId={sessionId}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={refetch}
      />
    </div>
  );
}
