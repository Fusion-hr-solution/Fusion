"use client";

import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2, GripVertical, Calendar, X } from "lucide-react";
import { Button, Card, CardContent, Badge } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getPartsForTraining,
  deletePart,
  reorderParts,
} from "@/services/admin-sessions-service";
import type { AdminTrainingPart, AdminTrainingSession } from "@/types/admin";
import { PartFormDialog } from "./part-form-dialog";
import { SessionFormDialog } from "./session-form-dialog";
import { CancelSessionDialog } from "./cancel-session-dialog";
import { SessionStatusBadge } from "./session-status-badge";
import {
  formatSessionDate,
  formatSessionTimeRange,
  isCapacityWarning,
} from "@/lib/session-helpers";

interface PartsManagerSectionProps {
  trainingId: string;
  isDeleted?: boolean;
}

export function PartsManagerSection({ trainingId, isDeleted }: PartsManagerSectionProps) {
  const fetchParts = useCallback(() => getPartsForTraining(trainingId), [trainingId]);
  const { data: parts, isLoading, refetch } = useApiQuery(fetchParts);

  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<AdminTrainingPart | null>(null);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<AdminTrainingSession | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);

  const { mutateAsync: doDeletePart } = useApiMutation(
    (partId: string) => deletePart(trainingId, partId),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (partIds: string[]) => reorderParts(trainingId, partIds),
    { onSuccess: () => refetch() },
  );

  async function handleDeletePart(part: AdminTrainingPart) {
    if (!confirm(`Delete part "${part.title}" and all its sessions?`)) return;
    await doDeletePart(part.id);
  }

  async function handleMove(index: number, dir: -1 | 1) {
    if (!parts) return;
    const target = index + dir;
    if (target < 0 || target >= parts.length) return;
    const ids = parts.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await doReorder(ids);
  }

  function openAddSession(partId: string) {
    setActivePartId(partId);
    setEditingSession(null);
    setSessionDialogOpen(true);
  }

  function openEditSession(partId: string, session: AdminTrainingSession) {
    setActivePartId(partId);
    setEditingSession(session);
    setSessionDialogOpen(true);
  }

  function openCancel(sessionId: string) {
    setCancellingSessionId(sessionId);
    setCancelOpen(true);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading parts...</p>;
  }

  const sortedParts = (parts ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Parts (Séances)</h2>
          <p className="text-xs text-muted-foreground">
            Each Part is a logical segment of the training. Add Sessions per Part to offer multiple time slots.
          </p>
        </div>
        {!isDeleted && (
          <Button
            size="sm"
            onClick={() => { setEditingPart(null); setPartDialogOpen(true); }}
            className="ey-bg-dark hover:opacity-90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Part
          </Button>
        )}
      </div>

      {sortedParts.length === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No parts yet. Add a Part to start scheduling in-person sessions.
            </p>
          </CardContent>
        </Card>
      )}

      {sortedParts.map((part, index) => (
        <Card key={part.id} className="border-border/60">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <Badge variant="outline" className="font-mono">#{index + 1}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{part.title}</p>
                {part.description && (
                  <p className="text-xs text-muted-foreground truncate">{part.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {part.durationHours}h · {part.sessions.length} session{part.sessions.length === 1 ? "" : "s"}
                </p>
              </div>
              {!isDeleted && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => handleMove(index, -1)}>↑</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === sortedParts.length - 1} onClick={() => handleMove(index, 1)}>↓</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingPart(part); setPartDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeletePart(part)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {part.sessions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No sessions yet.</p>
              )}
              {part.sessions
                .slice()
                .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime())
                .map((s) => {
                  const warn = isCapacityWarning(s.enrolledCount, s.maxCapacity);
                  return (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs">
                      <SessionStatusBadge status={s.status} />
                      <span className="font-mono">{formatSessionDate(s.startUtc)} · {formatSessionTimeRange(s.startUtc, s.endUtc)}</span>
                      <span>·</span>
                      <span>{s.room}</span>
                      <span className={`ml-auto ${warn ? "font-semibold text-[hsl(var(--ey-orange-500))]" : "text-muted-foreground"}`}>
                        {s.enrolledCount}/{s.maxCapacity}
                      </span>
                      {!isDeleted && s.status !== "Cancelled" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditSession(part.id, s)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => openCancel(s.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              {!isDeleted && (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => openAddSession(part.id)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Session
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <PartFormDialog
        trainingId={trainingId}
        part={editingPart}
        open={partDialogOpen}
        onOpenChange={setPartDialogOpen}
        onSaved={refetch}
      />

      {activePartId && (
        <SessionFormDialog
          trainingId={trainingId}
          partId={activePartId}
          session={editingSession}
          open={sessionDialogOpen}
          onOpenChange={setSessionDialogOpen}
          onSaved={refetch}
        />
      )}

      {cancellingSessionId && (
        <CancelSessionDialog
          sessionId={cancellingSessionId}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onCancelled={refetch}
        />
      )}
    </div>
  );
}
