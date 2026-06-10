"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Calendar,
  X,
  Clock,
  MapPin,
  Users,
  ChevronDown,
  ChevronRight,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Badge, Button, Card, CardContent } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getPartsForTraining,
  deletePart,
  reorderParts,
  togglePartLock,
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

/* ── Sortable Part Card ── */

interface SortablePartCardProps {
  part: AdminTrainingPart;
  index: number;
  isDeleted: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddSession: () => void;
  onEditSession: (session: AdminTrainingSession) => void;
  onCancelSession: (sessionId: string) => void;
  onToggleLock: () => void;
}

function SortablePartCard({
  part,
  index,
  isDeleted,
  onEdit,
  onDelete,
  onAddSession,
  onEditSession,
  onCancelSession,
  onToggleLock,
}: SortablePartCardProps) {
  const isPartCompleted = part.sessions.length > 0 &&
    part.sessions.every((s) => s.status === "Completed" || s.status === "Cancelled" || new Date(s.endUtc) < new Date());
  const [expanded, setExpanded] = useState(!isPartCompleted);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: part.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const sortedSessions = part.sessions
    .slice()
    .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-xl border bg-background transition-all ${
        isDragging
          ? "border-foreground/20 shadow-xl ring-2 ring-foreground/5 scale-[1.01]"
          : "border-border/50 hover:border-border hover:shadow-sm"
      }`}
    >
      {/* Part Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          disabled={isDeleted}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
          {index + 1}
        </span>

        <button
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{part.title}</p>
            {isPartCompleted && (
              <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5">
                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                Completed
              </Badge>
            )}
            {part.isLocked && (
              <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0.5">
                <Lock className="h-3 w-3 mr-0.5" />
                Locked
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {part.description && (
              <span className="truncate max-w-[200px]">{part.description}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {part.durationHours}h
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {part.sessions.length} session{part.sessions.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Actions — visible on hover */}
        {!isDeleted && (
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleLock}
              aria-label={part.isLocked ? "Unlock part" : "Lock part"}
              className={`h-8 w-8 p-0 ${part.isLocked ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : ""}`}
            >
              <Lock className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit part" className="h-8 w-8 p-0">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label="Delete part"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Sessions — collapsible */}
      {expanded && (
        <div className="border-t border-border/40 px-5 py-3 space-y-2">
          {sortedSessions.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 py-6 text-center">
              <div>
                <Calendar className="mx-auto h-6 w-6 text-muted-foreground/40" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  No sessions scheduled yet
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {sortedSessions.map((s) => {
                const warn = isCapacityWarning(s.enrolledCount, s.maxCapacity);
                const isCancelled = s.status === "Cancelled";
                return (
                  <div
                    key={s.id}
                    className={`group/session flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                      isCancelled
                        ? "border-border/30 bg-muted/20 opacity-60"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/60"
                    }`}
                  >
                    <SessionStatusBadge status={s.status} />
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatSessionDate(s.startUtc)}
                        <span className="text-muted-foreground font-normal">
                          {formatSessionTimeRange(s.startUtc, s.endUtc)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {s.room}
                      </span>
                      <span className={`flex items-center gap-1.5 ${warn ? "font-semibold text-[hsl(var(--ey-orange-500))]" : "text-muted-foreground"}`}>
                        <Users className="h-3 w-3" />
                        {s.enrolledCount}/{s.maxCapacity}
                      </span>
                    </div>

                    {!isDeleted && !isCancelled && (
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/session:opacity-100">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditSession(s)} aria-label="Edit session">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onCancelSession(s.id)} aria-label="Cancel session">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isDeleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddSession}
              disabled={part.isLocked}
              className="mt-1 border-dashed hover:border-solid transition-all"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Session
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Drag overlay preview ── */

function PartDragPreview({ part, index }: { part: AdminTrainingPart; index: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-foreground/20 bg-background px-5 py-4 shadow-2xl ring-2 ring-foreground/5">
      <GripVertical className="h-5 w-5 text-muted-foreground/30" />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{part.title}</p>
        <p className="text-xs text-muted-foreground">{part.durationHours}h · {part.sessions.length} sessions</p>
      </div>
    </div>
  );
}

/* ── Main Section ── */

interface PartsManagerSectionProps {
  trainingId: string;
  isDeleted?: boolean;
}

export function PartsManagerSection({ trainingId, isDeleted }: PartsManagerSectionProps) {
  const fetchParts = useCallback(() => getPartsForTraining(trainingId), [trainingId]);
  const { data: parts, isLoading, refetch } = useApiQuery(fetchParts);

  const [ordered, setOrdered] = useState<AdminTrainingPart[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<AdminTrainingPart | null>(null);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<AdminTrainingSession | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (parts) {
      setOrdered(parts.slice().sort((a, b) => a.orderIndex - b.orderIndex));
    }
  }, [parts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const { mutateAsync: doDeletePart } = useApiMutation(
    (partId: string) => deletePart(trainingId, partId),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (partIds: string[]) => reorderParts(trainingId, partIds),
    { onSuccess: () => refetch() },
  );

  const { mutateAsync: doToggleLock } = useApiMutation(
    ({ partId, lock }: { partId: string; lock: boolean }) => togglePartLock(trainingId, partId, lock),
    { onSuccess: () => refetch() },
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = ordered.findIndex((p) => p.id === active.id);
      const newIdx = ordered.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(ordered, oldIdx, newIdx);
      setOrdered(reordered);

      try {
        await doReorder(reordered.map((p) => p.id));
      } catch {
        setOrdered(ordered);
      }
    },
    [ordered, doReorder],
  );

  async function handleDeletePart(part: AdminTrainingPart) {
    if (!confirm(`Delete part "${part.title}" and all its sessions?`)) return;
    await doDeletePart(part.id);
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
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border/40 bg-muted/30" />
        ))}
      </div>
    );
  }

  const activeChapter = activeId ? ordered.find((p) => p.id === activeId) : null;
  const activeIndex = activeId ? ordered.findIndex((p) => p.id === activeId) : -1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Parts & Sessions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag to reorder parts. Each part can have multiple time-slot sessions.
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

      {/* Empty state */}
      {ordered.length === 0 && (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
              <Calendar className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No parts yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              Add a Part to start scheduling in-person sessions for this training.
            </p>
            {!isDeleted && (
              <Button
                size="sm"
                className="mt-4 ey-bg-dark hover:opacity-90"
                onClick={() => { setEditingPart(null); setPartDialogOpen(true); }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add First Part
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drag-and-drop list */}
      {ordered.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ordered.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {ordered.map((part, index) => (
                <SortablePartCard
                  key={part.id}
                  part={part}
                  index={index}
                  isDeleted={!!isDeleted}
                  onEdit={() => { setEditingPart(part); setPartDialogOpen(true); }}
                  onDelete={() => handleDeletePart(part)}
                  onAddSession={() => openAddSession(part.id)}
                  onEditSession={(s) => openEditSession(part.id, s)}
                  onCancelSession={(id) => openCancel(id)}
                  onToggleLock={() => doToggleLock({ partId: part.id, lock: !part.isLocked })}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeChapter && <PartDragPreview part={activeChapter} index={activeIndex} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Dialogs */}
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
