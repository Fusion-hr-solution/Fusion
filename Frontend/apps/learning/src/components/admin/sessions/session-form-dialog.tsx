"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Clock,
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
  DateTimePicker,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import {
  addSession,
  updateSession,
} from "@/services/admin-sessions-service";
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
  const isEditing = !!session;
  const [step, setStep] = useState(0);

  const [start, setStart] = useState<Date | undefined>(undefined);
  const [end, setEnd] = useState<Date | undefined>(undefined);
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [trainerName, setTrainerName] = useState("");
  const [trainerEmail, setTrainerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<RoomConflict[]>([]);

  const totalSteps = isEditing ? 1 : 2;

  useEffect(() => {
    if (open) {
      setStep(0);
      setStart(parseIsoToLocal(session?.startUtc));
      setEnd(parseIsoToLocal(session?.endUtc));
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
    },
  );

  const { mutateAsync: doUpdate, isLoading: updatePending } = useApiMutation(
    (input: CreateSessionInput) => updateSession(session!.id, input),
    {
      onSuccess: (res) => {
        setConflicts(res.roomConflicts);
        onSaved();
        if (res.roomConflicts.length === 0) onOpenChange(false);
      },
    },
  );

  function validateFields(): boolean {
    if (!start || !end) { setError("Start and end times are required."); return false; }
    if (end <= start) { setError("End must be after start."); return false; }
    if (!room.trim()) { setError("Room is required."); return false; }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) { setError("Capacity must be > 0."); return false; }
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
      setError(e instanceof Error ? e.message : "Failed to save session.");
    }
  }

  const isLoading = addPending || updatePending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Session" : "Schedule New Session"}</DialogTitle>
        </DialogHeader>

        {/* Step indicator for create mode */}
        {!isEditing && (
          <div className="flex items-center justify-center gap-0 py-2">
            {[
              { label: "Details", icon: Calendar },
              { label: "Review", icon: CheckCircle2 },
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
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={`text-xs font-medium ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  {index < 1 && (
                    <div className={`mx-4 mb-5 h-0.5 w-16 rounded-full transition-colors duration-300 ${index < step ? "bg-[hsl(var(--ey-green-500))]" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 0: Form fields */}
        {step === 0 && (
          <div className="space-y-5 pt-2">
            {/* Schedule section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Schedule
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start *</Label>
                  <DateTimePicker
                    value={start}
                    onChange={(d) => { setStart(d); setError(null); }}
                    placeholder="Pick start date & time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End *</Label>
                  <DateTimePicker
                    value={end}
                    onChange={(d) => { setEnd(d); setError(null); }}
                    placeholder="Pick end date & time"
                    minDate={start}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Location section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Location & Capacity
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionRoom" className="text-xs">Room *</Label>
                  <Input
                    id="sessionRoom"
                    value={room}
                    onChange={(e) => { setRoom(e.target.value); setError(null); }}
                    placeholder="e.g. Room A, Building 3"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sessionCapacity" className="text-xs">Max Capacity *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="sessionCapacity"
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="h-10 pl-9"
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
                Trainer
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="trainerName" className="text-xs">Name</Label>
                  <Input
                    id="trainerName"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    placeholder="Trainer full name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trainerEmail" className="text-xs">Email</Label>
                  <Input
                    id="trainerEmail"
                    type="email"
                    value={trainerEmail}
                    onChange={(e) => setTrainerEmail(e.target.value)}
                    placeholder="trainer@company.com"
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
                Notes
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </div>
              <Input
                id="sessionNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information for this session..."
                className="h-10"
              />
            </div>
          </div>
        )}

        {/* Step 1: Review (create mode) */}
        {step === 1 && !isEditing && (
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Session Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Start</p>
                  <p className="font-medium">{start ? start.toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> End</p>
                  <p className="font-medium">{end ? end.toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Room</p>
                  <p className="font-medium">{room || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Capacity</p>
                  <p className="font-medium">{capacity}</p>
                </div>
                {trainerName && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Trainer</p>
                    <p className="font-medium">{trainerName} {trainerEmail && `(${trainerEmail})`}</p>
                  </div>
                )}
                {notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Notes</p>
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
              Room conflict detected
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {conflicts.map((c) => (
                <li key={c.sessionId} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ey-orange-500))]" />
                  {c.trainingTitle} → {c.partTitle} · {c.room} · {new Date(c.startUtc).toLocaleString()}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Session was saved. Review room/timing if this is unintended.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        <DialogFooter className="gap-2 pt-2">
          {step > 0 && !isEditing && (
            <Button variant="outline" onClick={() => setStep(0)} disabled={isLoading} className="mr-auto">
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {conflicts.length > 0 ? "Close" : "Cancel"}
          </Button>
          {(isEditing || step === totalSteps - 1) ? (
            <Button onClick={handleSubmit} disabled={isLoading} className="ey-bg-dark hover:opacity-90">
              {isLoading ? "Saving..." : isEditing ? "Update Session" : "Create Session"}
            </Button>
          ) : (
            <Button onClick={handleNext} className="ey-bg-dark hover:opacity-90">
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
