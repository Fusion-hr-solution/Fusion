"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { MeasurementDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@repo/ds/components/ui/button-group";
import { Input } from "@repo/ds/components/ui/input";
import { cn } from "@repo/ds/lib/utils";

export interface MilestoneRow {
  /** Stable identity for drag-reordering and list keys — order carries meaning, so it can't be index. */
  id: string;
  title: string;
  weight: string;
}

export function emptyMilestone(): MilestoneRow {
  return { id: crypto.randomUUID(), title: "", weight: "" };
}

/** Editable rows from a stored measurement, or a single empty row to start from. */
export function milestonesFromMeasurement(measurement?: MeasurementDto | null): MilestoneRow[] {
  const rows = measurement?.method === "WeightedMilestones" ? measurement.milestones : null;
  return rows && rows.length > 0
    ? rows.map((m) => ({ id: crypto.randomUUID(), title: m.title, weight: String(m.weight) }))
    : [emptyMilestone()];
}

export function milestoneWeightSum(rows: MilestoneRow[]): number {
  return rows.reduce((total, row) => total + (Number(row.weight) || 0), 0);
}

/**
 * The weighted-milestone editor: reorderable rows of title + weight that must total 100%, with a
 * live allocation readout. Order carries meaning (earliest milestone first), so rows are dragged by
 * a handle and keyed by stable id. Shared by the organizational-objective composer and the employee
 * objective composer — the one place this interaction is defined.
 */
export function MilestoneEditor({
  milestones,
  weightSum,
  onChange,
  readyLabel = "Balanced",
}: {
  milestones: MilestoneRow[];
  weightSum: number;
  onChange: (next: MilestoneRow[] | ((rows: MilestoneRow[]) => MilestoneRow[])) => void;
  /** Text shown beside the total once weights reach exactly 100% (context-specific). */
  readyLabel?: string;
}) {
  const remaining = 100 - weightSum;
  const empty = weightSum === 0;
  const ready = weightSum === 100;
  const over = weightSum > 100;
  const sensors = useSensors(
    // A small drag threshold keeps a click inside the title/weight fields from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over: target } = event;
    if (!target || active.id === target.id) return;
    onChange((rows) => {
      const from = rows.findIndex((row) => row.id === active.id);
      const to = rows.findIndex((row) => row.id === target.id);
      return from === -1 || to === -1 ? rows : arrayMove(rows, from, to);
    });
  }

  const setTitle = (id: string, title: string) =>
    onChange((rows) => rows.map((row) => (row.id === id ? { ...row, title } : row)));
  const setWeight = (id: string, weight: string) =>
    onChange((rows) => rows.map((row) => (row.id === id ? { ...row, weight } : row)));
  const removeRow = (id: string) =>
    onChange((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={milestones.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {milestones.map((row, index) => (
              <SortableMilestoneRow
                key={row.id}
                row={row}
                index={index}
                canRemove={milestones.length > 1}
                onTitle={(value) => setTitle(row.id, value)}
                onWeight={(value) => setWeight(row.id, value)}
                onRemove={() => removeRow(row.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange((rows) => [...rows, emptyMilestone()])}
        >
          <Plus className="size-3.5" data-icon="inline-start" /> Add milestone
        </Button>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground">
            {ready ? readyLabel : over ? `${weightSum - 100}% over` : `${remaining}% to allocate`}
          </span>
          <span
            className={cn(
              "min-w-[3.25rem] rounded-md px-2 py-0.5 text-center text-sm font-semibold tabular-nums transition-colors",
              ready
                ? "bg-success-subtle text-success"
                : over
                  ? "bg-destructive/10 text-destructive"
                  : empty
                    ? "bg-muted text-muted-foreground"
                    : "bg-warning-subtle text-warning"
            )}
          >
            {weightSum}%
          </span>
        </div>
      </div>
    </div>
  );
}

function SortableMilestoneRow({
  row,
  index,
  canRemove,
  onTitle,
  onWeight,
  onRemove,
}: {
  row: MilestoneRow;
  index: number;
  canRemove: boolean;
  onTitle: (value: string) => void;
  onWeight: (value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg",
        isDragging && "relative z-10 bg-card shadow-overlay"
      )}
    >
      <button
        type="button"
        className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={`Reorder milestone ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <Input
        value={row.title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder={`Milestone ${index + 1}`}
        className="flex-1"
      />
      <ButtonGroup className="w-28 shrink-0">
        <Input
          type="number"
          value={row.weight}
          onChange={(event) => onWeight(event.target.value)}
          placeholder="0"
          className="text-right tabular-nums"
        />
        <ButtonGroupText>%</ButtonGroupText>
      </ButtonGroup>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove milestone ${index + 1}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
