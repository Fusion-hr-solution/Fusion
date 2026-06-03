"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  X,
  Copy,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  FileText,
  CalendarPlus,
  FileSpreadsheet,
  FileDown,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label, Progress, Separator } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getSessionDetail,
  duplicateSession,
  exportSessionParticipantsExcel,
  exportSessionParticipantsPdf,
  markAttendance,
} from "@/services/admin-sessions-service";
import { getIdentityUsers } from "@/services/admin-dashboard-service";
import { downloadBlob } from "@/lib/download";
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
  const identityFetcher = useCallback(() => getIdentityUsers(), []);
  const { data: identityUsers } = useApiQuery(identityFetcher);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [duplicateNew, setDuplicateNew] = useState("");

  // Resolve attendee names from identity service for enrollments missing names
  const resolvedAttendees = useMemo(() => {
    if (!session?.attendees) return [];
    if (!identityUsers?.length) return session.attendees;
    const userMap = new Map(identityUsers.map((u) => [u.id, u]));
    return session.attendees.map((a) => {
      if (a.fullName) return a;
      const user = userMap.get(a.employeeId);
      return user ? { ...a, fullName: user.fullName, email: a.email ?? user.email } : a;
    });
  }, [session?.attendees, identityUsers]);

  const { mutateAsync: doDuplicate, isLoading: dupPending } = useApiMutation(
    () => duplicateSession(sessionId, {
      newStartUtc: new Date(duplicateNew).toISOString(),
      occurrences: 1,
      intervalDays: 7,
    }),
    { onSuccess: () => { refetch(); setDuplicateNew(""); } },
  );

  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkAttendance = useCallback(
    async (employeeId: string) => {
      setMarkingId(employeeId);
      try {
        await markAttendance(sessionId, employeeId);
        refetch();
      } finally {
        setMarkingId(null);
      }
    },
    [sessionId, refetch],
  );

  const handleExport = useCallback(
    async (format: "excel" | "pdf") => {
      const setBusy = format === "excel" ? setExportingExcel : setExportingPdf;
      setBusy(true);
      try {
        const blob =
          format === "excel"
            ? await exportSessionParticipantsExcel(sessionId)
            : await exportSessionParticipantsPdf(sessionId);
        const safeTitle = (session?.trainingTitle ?? "session")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase();
        const datePart = session?.startUtc
          ? new Date(session.startUtc).toISOString().slice(0, 10)
          : "";
        const ext = format === "excel" ? "xlsx" : "pdf";
        downloadBlob(blob, `participants-${safeTitle}-${datePart}.${ext}`);
      } finally {
        setBusy(false);
      }
    },
    [sessionId, session?.trainingTitle, session?.startUtc],
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-64 animate-pulse rounded-xl border border-border/40 bg-muted/30" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-destructive">Session not found.</p>
        <Link href="/admin/sessions">
          <Button variant="outline" size="sm" className="mt-3">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Sessions
          </Button>
        </Link>
      </div>
    );
  }

  const ratio = session.maxCapacity > 0
    ? Math.min(100, (session.enrolledCount / session.maxCapacity) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/admin/sessions">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Sessions
          </Button>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-lg font-semibold text-foreground truncate">{session.trainingTitle}</h1>
        <SessionStatusBadge status={session.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info card */}
        <Card className="lg:col-span-2 border-border/50">
          <CardContent className="py-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Session Details</h2>
              {session.status !== "Cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelOpen(true)}
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel Session
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Part</p>
                  <p className="text-sm font-medium">{session.partTitle}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatSessionDate(session.startUtc)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium font-mono">{formatSessionTimeRange(session.startUtc, session.endUtc)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Room</p>
                  <p className="text-sm font-medium">{session.room}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trainer</p>
                  <p className="text-sm font-medium">{session.trainerName ?? "Not assigned"}</p>
                  {session.trainerEmail && (
                    <p className="text-xs text-muted-foreground">{session.trainerEmail}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Capacity</p>
                  <p className={`text-sm font-medium ${session.capacityWarning ? "text-[hsl(var(--ey-orange-500))]" : ""}`}>
                    {session.enrolledCount} / {session.maxCapacity}
                    <span className="text-xs text-muted-foreground ml-1.5">({Math.round(ratio)}%)</span>
                  </p>
                  <Progress value={ratio} className="mt-2 h-2" />
                </div>
              </div>
            </div>

            {session.capacityWarning && (
              <div className="flex items-center gap-2.5 rounded-lg border border-[hsl(var(--ey-yellow))]/40 bg-[hsl(var(--ey-yellow))]/10 px-4 py-3 text-sm text-[hsl(var(--ey-orange-500))]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Capacity is at or above 90%. Consider adding another session.</span>
              </div>
            )}

            {session.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{session.notes}</p>
                </div>
              </>
            )}

            {session.status === "Cancelled" && session.cancelReason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm">
                  <span className="font-medium text-destructive">Cancellation reason:</span>{" "}
                  <span className="text-foreground">{session.cancelReason}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Duplicate card */}
          <Card className="border-border/50">
            <CardContent className="py-5 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Duplicate Session</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Create a copy of this session at a new date/time.
              </p>
              <div className="space-y-2">
                <Label htmlFor="dupStart" className="text-xs">New start time</Label>
                <Input
                  id="dupStart"
                  type="datetime-local"
                  value={duplicateNew}
                  onChange={(e) => setDuplicateNew(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button
                onClick={() => doDuplicate()}
                disabled={!duplicateNew || dupPending}
                size="sm"
                className="w-full ey-bg-dark hover:opacity-90"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {dupPending ? "Duplicating..." : "Duplicate"}
              </Button>
            </CardContent>
          </Card>

          {/* Attendees card */}
          <Card className="border-border/50">
            <CardContent className="py-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Enrolled</h3>
                </div>
                <span className="text-xs text-muted-foreground">{resolvedAttendees.length} people</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  disabled={resolvedAttendees.length === 0 || exportingExcel}
                  onClick={() => handleExport("excel")}
                  aria-label="Export participant list as Excel"
                >
                  {exportingExcel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={resolvedAttendees.length === 0 || exportingPdf}
                  onClick={() => handleExport("pdf")}
                  aria-label="Export participant list as PDF"
                >
                  {exportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  PDF
                </Button>
              </div>
              {resolvedAttendees.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-center">
                  <Users className="h-6 w-6 text-muted-foreground/40" />
                  <p className="mt-1.5 text-xs text-muted-foreground">No enrolled employees yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                  {resolvedAttendees.map((a) => (
                    <div key={a.employeeId} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {(a.fullName ?? a.employeeId).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{a.fullName ?? a.employeeId}</p>
                        {a.email && <p className="text-[10px] text-muted-foreground truncate">{a.email}</p>}
                      </div>
                      {a.status === "Attended" ? (
                        <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" />
                          Attended
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-6 px-2 text-[10px] text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50"
                          disabled={markingId === a.employeeId}
                          onClick={() => handleMarkAttendance(a.employeeId)}
                        >
                          {markingId === a.employeeId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              Mark
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CancelSessionDialog
        sessionId={sessionId}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={refetch}
      />
    </div>
  );
}
