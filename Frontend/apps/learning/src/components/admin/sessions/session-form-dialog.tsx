"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Lock,
  MapPin,
  Users,
  User,
  FileText,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Separator,
  Calendar as CalendarWidget,
} from "@repo/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useApiMutation } from "@repo/api/react";
import { addSession, updateSession } from "@/services/admin-sessions-service";
import type {
  AdminTrainingSession,
  CreateSessionInput,
  RoomConflict,
} from "@/types/admin";

interface SessionFormDialogProps {
  trainingId: string;
  partId: string;
  session: AdminTrainingSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function parseIsoToLocal(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  return new Date(iso);
}

export function SessionFormDialog({
  trainingId,
  partId,
  session,
  open,
  onOpenChange,
  onSaved,
}: SessionFormDialogProps) {
  const t = useTranslations("adminSessions");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const isEditing = !!session;
  const isCompleted =
    isEditing &&
    (session.status === "Completed" || new Date(session.endUtc) < new Date());
  const [step, setStep] = useState(0);

  const [sessionDate, setSessionDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [trainerName, setTrainerName] = useState("");
  const [trainerEmail, setTrainerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<RoomConflict[]>([]);

  // Derive full Date objects from sessionDate + time strings
  function buildDateTime(
    date: Date | undefined,
    time: string
  ): Date | undefined {
    if (!date) return undefined;
    const parts = time.split(":").map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const start = buildDateTime(sessionDate, startTime);
  const end = buildDateTime(sessionDate, endTime);

  const totalSteps = isEditing ? 1 : 2;

  useEffect(() => {
    if (open) {
      setStep(0);
      const existingStart = parseIsoToLocal(session?.startUtc);
      const existingEnd = parseIsoToLocal(session?.endUtc);
      setSessionDate(existingStart);
      setStartTime(
        existingStart
          ? `${String(existingStart.getHours()).padStart(2, "0")}:${String(existingStart.getMinutes()).padStart(2, "0")}`
          : "09:00"
      );
      setEndTime(
        existingEnd
          ? `${String(existingEnd.getHours()).padStart(2, "0")}:${String(existingEnd.getMinutes()).padStart(2, "0")}`
          : "10:00"
      );
      setRoom(session?.room ?? "");
      setCapacity(String(session?.maxCapacity ?? 20));
      setTrainerName(session?.trainerName ?? "");
      setTrainerEmail(session?.trainerEmail ?? "");
      setNotes(session?.notes ?? "");
      setError(null);
      setConflicts([]);
    }
  }, [open, session]);

  const { mutateAsync: doAdd, isLoading: addPending } = useApiMutation(
    (input: CreateSessionInput) => addSession(trainingId, partId, input),
    {
      onSuccess: (res) => {
        setConflicts(res.roomConflicts);
        onSaved();
        if (res.roomConflicts.length === 0) onOpenChange(false);
      },
    }
  );

  const { mutateAsync: doUpdate, isLoading: updatePending } = useApiMutation(
    (input: CreateSessionInput) => updateSession(session!.id, input),
    {
      onSuccess: (res) => {
        setConflicts(res.roomConflicts);
        onSaved();
        if (res.roomConflicts.length === 0) onOpenChange(false);
      },
    }
  );

  function validateFields(): boolean {
    if (isCompleted) {
      // Only trainer/notes are editable for completed sessions
      setError(null);
      return true;
    }
    if (!sessionDate) {
      setError(t("sessionDialog.dateRequired"));
      return false;
    }
    if (!start || !end) {
      setError(t("sessionDialog.timesRequired"));
      return false;
    }
    if (end <= start) {
      setError(t("sessionDialog.endAfterStart"));
      return false;
    }
    if (!room.trim()) {
      setError(t("sessionDialog.roomRequired"));
      return false;
    }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) {
      setError(t("sessionDialog.capacityPositive"));
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (!validateFields()) return;
    setStep(1);
  }

  async function handleSubmit() {
    if (!validateFields()) return;

    const input: CreateSessionInput = {
      startUtc: start!.toISOString(),
      endUtc: end!.toISOString(),
      room: room.trim(),
      maxCapacity: Number(capacity),
      notes: notes.trim() || undefined,
      trainerName: trainerName.trim() || undefined,
      trainerEmail: trainerEmail.trim() || undefined,
    };

    try {
      if (isEditing) await doUpdate(input);
      else await doAdd(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sessionDialog.saveFailed"));
    }
  }

  const isLoading = addPending || updatePending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing
              ? t("sessionDialog.editTitle")
              : t("sessionDialog.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* Step indicator for create mode */}
          {!isEditing && (
            <div className="flex items-center justify-center gap-0 py-2">
              {[
                { label: t("sessionDialog.stepDetails"), icon: Calendar },
                { label: t("sessionDialog.stepReview"), icon: CheckCircle2 },
              ].map((s, index) => {
                const isCompleted = index < step;
                const isCurrent = index === step;
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                          isCompleted
                            ? "border-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))] text-white"
                            : isCurrent
                              ? "border-[hsl(var(--ey-black))] bg-[hsl(var(--ey-black))] text-white shadow-md"
                              : "border-border bg-white text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {index < 1 && (
                      <div
                        className={`mx-4 mb-5 h-0.5 w-16 rounded-full transition-colors duration-300 ${index < step ? "bg-[hsl(var(--ey-green-500))]" : "bg-muted"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 0: Form fields */}
          {step === 0 && (
            <div className="space-y-5 pt-2">
              {/* Lock banner for completed sessions */}
              {isCompleted && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">
                    {t("sessionDialog.endedBanner")}
                  </p>
                </div>
              )}

              {/* Schedule section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {t("sessionDialog.schedule")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("sessionDialog.dateLabel")}
                    </Label>
                    <CalendarWidget
                      mode="single"
                      selected={sessionDate}
                      onSelect={(d) => {
                        if (!isCompleted) {
                          setSessionDate(d ?? undefined);
                          setError(null);
                        }
                      }}
                      disabled={
                        isCompleted
                          ? () => true
                          : (date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      className={`rounded-md border ${isCompleted ? "opacity-50 pointer-events-none" : ""}`}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t("sessionDialog.startTimeLabel")}
                      </Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setError(null);
                        }}
                        className="h-10"
                        disabled={isCompleted}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t("sessionDialog.endTimeLabel")}
                      </Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          setError(null);
                        }}
                        className="h-10"
                        disabled={isCompleted}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {t("sessionDialog.locationCapacity")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sessionRoom" className="text-xs">
                      {t("sessionDialog.roomLabel")}
                    </Label>
                    <Input
                      id="sessionRoom"
                      value={room}
                      onChange={(e) => {
                        setRoom(e.target.value);
                        setError(null);
                      }}
                      placeholder={t("sessionDialog.roomPlaceholder")}
                      className="h-10"
                      disabled={isCompleted}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sessionCapacity" className="text-xs">
                      {t("sessionDialog.maxCapacityLabel")}
                    </Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="sessionCapacity"
                        type="number"
                        min={1}
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        className="h-10 pl-9"
                        disabled={isCompleted}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Trainer section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {t("sessionDialog.trainer")}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("sessionDialog.optional")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="trainerName" className="text-xs">
                      {t("sessionDialog.trainerNameLabel")}
                    </Label>
                    <Input
                      id="trainerName"
                      value={trainerName}
                      onChange={(e) => setTrainerName(e.target.value)}
                      placeholder={t("sessionDialog.trainerNamePlaceholder")}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="trainerEmail" className="text-xs">
                      {t("sessionDialog.trainerEmailLabel")}
                    </Label>
                    <Input
                      id="trainerEmail"
                      type="email"
                      value={trainerEmail}
                      onChange={(e) => setTrainerEmail(e.target.value)}
                      placeholder={t("sessionDialog.trainerEmailPlaceholder")}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notes section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {t("sessionDialog.notes")}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("sessionDialog.optional")}
                  </span>
                </div>
                <Input
                  id="sessionNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("sessionDialog.notesPlaceholder")}
                  className="h-10"
                />
              </div>
            </div>
          )}

          {/* Step 1: Review (create mode) */}
          {step === 1 && !isEditing && (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("sessionDialog.summaryTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{" "}
                      {t("sessionDialog.start")}
                    </p>
                    <p className="font-medium">
                      {start
                        ? format.dateTime(start, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : t("sessionDialog.empty")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {t("sessionDialog.end")}
                    </p>
                    <p className="font-medium">
                      {end
                        ? format.dateTime(end, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : t("sessionDialog.empty")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {t("sessionDialog.room")}
                    </p>
                    <p className="font-medium">
                      {room || t("sessionDialog.empty")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />{" "}
                      {t("sessionDialog.capacity")}
                    </p>
                    <p className="font-medium">{capacity}</p>
                  </div>
                  {trainerName && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />{" "}
                        {t("sessionDialog.trainer")}
                      </p>
                      <p className="font-medium">
                        {t("sessionDialog.trainerSummary", {
                          name: trainerName,
                          email: trainerEmail || "none",
                        })}
                      </p>
                    </div>
                  )}
                  {notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />{" "}
                        {t("sessionDialog.notes")}
                      </p>
                      <p className="font-medium">{notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--ey-yellow))]/40 bg-[hsl(var(--ey-yellow))]/10 p-4 mt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--ey-orange-500))]">
                <AlertTriangle className="h-4 w-4" />
                {t("sessionDialog.roomConflictDetected")}
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {conflicts.map((c) => (
                  <li key={c.sessionId} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ey-orange-500))]" />
                    {t("sessionDialog.conflictLine", {
                      trainingTitle: c.trainingTitle,
                      partTitle: c.partTitle,
                      room: c.room,
                      when: format.dateTime(new Date(c.startUtc), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("sessionDialog.conflictNote")}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        <DialogFooter className="shrink-0 gap-2 pt-2">
          {step > 0 && !isEditing && (
            <Button
              variant="outline"
              onClick={() => setStep(0)}
              disabled={isLoading}
              className="mr-auto"
            >
              {tCommon("actions.back")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {conflicts.length > 0
              ? tCommon("actions.close")
              : tCommon("actions.cancel")}
          </Button>
          {isEditing || step === totalSteps - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="ey-bg-dark hover:opacity-90"
            >
              {isLoading
                ? tCommon("actions.saving")
                : isEditing
                  ? t("sessionDialog.updateSession")
                  : t("sessionDialog.createSession")}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="ey-bg-dark hover:opacity-90"
            >
              {tCommon("actions.next")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
