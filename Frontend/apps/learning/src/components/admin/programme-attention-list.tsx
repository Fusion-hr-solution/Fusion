"use client";

import { useTranslations } from "next-intl";
import type { ProgrammeMatrix } from "@/types/admin";

interface ProgrammeAttentionListProps {
  matrix: ProgrammeMatrix;
  onCellClick: (gradeId: string, serviceLineId: string) => void;
}

/** Completion-band bar color (EY tokens, dark-mode safe). */
function barColor(rate: number): string {
  if (rate >= 80) return "bg-[hsl(var(--ey-green-500))]";
  if (rate >= 50) return "bg-[hsl(var(--ey-orange-500))]";
  return "bg-[hsl(var(--ey-red-500))]";
}

interface Tile {
  gradeId: string;
  serviceLineId: string;
  gradeName: string;
  slName: string;
  color: string;
  rate: number;
  count: number;
}

/**
 * Grade x service-line completion as a compact grid of tiles (sorted by lowest
 * completion first) instead of a wide 2D matrix — readable at a glance and easy
 * to scan. Clicking a tile drills into per-employee detail.
 */
export function ProgrammeAttentionList({ matrix, onCellClick }: ProgrammeAttentionListProps) {
  const t = useTranslations("adminDashboard");
  const gradeById = new Map(matrix.grades.map((g) => [g.id, g]));
  const slById = new Map(matrix.serviceLines.map((s) => [s.id, s]));

  const tiles: Tile[] = matrix.cells
    .filter((c) => c.employeeCount > 0)
    .map((c) => ({
      gradeId: c.gradeId,
      serviceLineId: c.serviceLineId,
      gradeName: gradeById.get(c.gradeId)?.name ?? "—",
      slName: slById.get(c.serviceLineId)?.name ?? "—",
      color: slById.get(c.serviceLineId)?.color ?? "hsl(var(--muted-foreground))",
      rate: c.avgCompletionRate,
      count: c.employeeCount,
    }))
    .sort((a, b) => a.rate - b.rate);

  if (tiles.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("attention.empty")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tiles.map((tile) => (
        <button
          key={`${tile.gradeId}:${tile.serviceLineId}`}
          type="button"
          onClick={() => onCellClick(tile.gradeId, tile.serviceLineId)}
          aria-label={t("attention.tileAria", {
            grade: tile.gradeName,
            sl: tile.slName,
            rate: tile.rate,
            count: tile.count,
          })}
          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-left shadow-sm transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: tile.color }}
              aria-hidden="true"
            />
            <span className="truncate" title={tile.slName}>
              {tile.slName}
            </span>
          </div>

          <div className="truncate text-sm font-medium text-foreground" title={tile.gradeName}>
            {tile.gradeName}
          </div>

          <div className="flex items-end justify-between gap-2">
            <span className="text-lg font-bold leading-none tabular-nums text-foreground">
              {tile.rate}%
            </span>
            <span className="text-xs text-muted-foreground">
              {t("attention.people", { count: tile.count })}
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barColor(tile.rate)}`}
              style={{ width: `${Math.max(tile.rate, 2)}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
