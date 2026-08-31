"use client";

import { ChevronRight, LineChart, Pencil, Target, Trash2, Unlink } from "lucide-react";
import type { PlanObjectiveDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { pct } from "./plan-lib";

/**
 * One objective inside a plan, presented as a numbered ledger row rather than a card. The alignment
 * (direction path) or standalone marker sits under the title, the measurement summary is quiet, and
 * the plan weight is the emphasized figure on the right. In author mode, edit and remove appear on
 * hover so the reading rhythm stays clean.
 */
export function PlanObjectiveRow({
  index,
  objective,
  editable = false,
  showProgress = false,
  onEdit,
  onRemove,
  onOpenProgress,
}: {
  index: number;
  objective: PlanObjectiveDto;
  editable?: boolean;
  showProgress?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  onOpenProgress?: () => void;
}) {
  const weight = objective.planWeight ?? 0;
  const progress = objective.derivedProgress;
  const capped = Math.min(progress, 100);
  return (
    <div className="group flex items-start gap-4 py-4">
      <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground/70">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-medium tracking-tight">{objective.title}</p>

        {objective.isAligned && objective.directionPath.length > 0 ? (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {objective.directionPath.map((label, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3 opacity-50" aria-hidden /> : null}
                {label}
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Unlink className="size-3" aria-hidden /> Standalone role objective
          </p>
        )}

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Target className="size-3" aria-hidden /> {objective.measurementSummary}
        </p>

        {/* Progress track for a locked plan — missing reads as missing, not 0%. */}
        {showProgress ? (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
              {objective.hasProgress ? (
                <span className={cn("block h-full rounded-full", progress >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${capped}%` }} />
              ) : null}
            </div>
            <span className={cn("text-xs tabular-nums", objective.hasProgress ? (progress >= 100 ? "text-success" : "text-muted-foreground") : "text-muted-foreground/60")}>
              {objective.hasProgress ? `${pct(progress)}%` : "Not started"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className={cn("w-14 text-right text-lg font-semibold tabular-nums", weight > 0 ? "text-foreground" : "text-muted-foreground/50")}>
          {pct(weight)}%
        </span>
        {editable ? (
          <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit objective">
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove objective">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
        {showProgress && objective.canUpdateProgress ? (
          <Button variant="outline" size="sm" onClick={onOpenProgress}>
            <LineChart className="size-3.5" data-icon="inline-start" /> Update
          </Button>
        ) : showProgress ? (
          <Button variant="ghost" size="sm" onClick={onOpenProgress}>
            View
          </Button>
        ) : null}
      </div>
    </div>
  );
}
