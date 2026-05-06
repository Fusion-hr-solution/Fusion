"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
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

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toUtcIsoFromLocalInput(local: string): string {
  return new Date(local).toISOString();
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

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [trainerName, setTrainerName] = useState("");
  const [trainerEmail, setTrainerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<RoomConflict[]>([]);

  useEffect(() => {
    if (open) {
      setStart(toLocalInputValue(session?.startUtc));
      setEnd(toLocalInputValue(session?.endUtc));
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

  async function handleSubmit() {
    setError(null);
    if (!start || !end) { setError("Start and end times are required."); return; }
    if (new Date(end) <= new Date(start)) { setError("End must be after start."); return; }
    if (!room.trim()) { setError("Room is required."); return; }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) { setError("Capacity must be > 0."); return; }

    const input: CreateSessionInput = {
      startUtc: toUtcIsoFromLocalInput(start),
      endUtc: toUtcIsoFromLocalInput(end),
      room: room.trim(),
      maxCapacity: cap,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Session" : "Add Session"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sessionStart">Start *</Label>
              <Input id="sessionStart" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sessionEnd">End *</Label>
              <Input id="sessionEnd" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sessionRoom">Room *</Label>
              <Input id="sessionRoom" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room A" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sessionCapacity">Capacity *</Label>
              <Input id="sessionCapacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trainerName">Trainer Name</Label>
              <Input id="trainerName" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trainerEmail">Trainer Email</Label>
              <Input id="trainerEmail" type="email" value={trainerEmail} onChange={(e) => setTrainerEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sessionNotes">Notes</Label>
            <Input id="sessionNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-md border border-[hsl(var(--ey-yellow))]/40 bg-[hsl(var(--ey-yellow))]/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--ey-orange-500))]">
                <AlertTriangle className="h-4 w-4" />
                Room conflict warning
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {conflicts.map((c) => (
                  <li key={c.sessionId}>
                    {c.trainingTitle} → {c.partTitle} · {c.room} · {new Date(c.startUtc).toLocaleString()}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                The session was saved. Review room/timing if this is unintended.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {conflicts.length > 0 ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
