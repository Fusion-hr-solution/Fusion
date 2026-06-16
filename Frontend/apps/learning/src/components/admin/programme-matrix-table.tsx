"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@repo/ui";
import type { ProgrammeMatrix } from "@/types/admin";

interface ProgrammeMatrixTableProps {
  matrix: ProgrammeMatrix;
  onCellClick: (gradeId: string, serviceLineId: string) => void;
}

/** Subtle EY-token tint per completion band (color is reinforced by the dot + the number). */
function cellTint(rate: number): string {
  if (rate >= 80) return "bg-[hsl(var(--ey-green-500))]/10 border-[hsl(var(--ey-green-500))]/30";
  if (rate >= 50) return "bg-[hsl(var(--ey-orange-500))]/10 border-[hsl(var(--ey-orange-500))]/30";
  return "bg-[hsl(var(--ey-red-500))]/10 border-[hsl(var(--ey-red-500))]/30";
}

function cellDot(rate: number): string {
  if (rate >= 80) return "bg-[hsl(var(--ey-green-500))]";
  if (rate >= 50) return "bg-[hsl(var(--ey-orange-500))]";
  return "bg-[hsl(var(--ey-red-500))]";
}

const LEGEND = [
  { dot: "bg-[hsl(var(--ey-green-500))]", label: "≥ 80%" },
  { dot: "bg-[hsl(var(--ey-orange-500))]", label: "50–79%" },
  { dot: "bg-[hsl(var(--ey-red-500))]", label: "< 50%" },
];

export function ProgrammeMatrixTable({ matrix, onCellClick }: ProgrammeMatrixTableProps) {
  const { grades, serviceLines, cells } = matrix;

  const cellLookup = new Map(cells.map((c) => [`${c.gradeId}:${c.serviceLineId}`, c]));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${l.dot}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="sticky left-0 z-10 bg-muted/40 min-w-[140px] font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Grade
              </TableHead>
              {serviceLines.map((sl) => (
                <TableHead
                  key={sl.id}
                  className="min-w-[130px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: sl.color }}
                    />
                    {sl.name}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grades.map((grade) => (
              <TableRow key={grade.id} className="hover:bg-muted/20 transition-colors">
                <TableCell className="sticky left-0 z-10 bg-card font-medium text-sm">
                  {grade.name}
                </TableCell>
                {serviceLines.map((sl) => {
                  const cell = cellLookup.get(`${grade.id}:${sl.id}`);
                  if (!cell || cell.employeeCount === 0) {
                    return (
                      <TableCell key={sl.id} className="text-center">
                        <span className="text-xs text-muted-foreground/50">—</span>
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={sl.id} className="text-center p-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onCellClick(grade.id, sl.id)}
                            className={`inline-flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer ${cellTint(cell.avgCompletionRate)}`}
                          >
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${cellDot(cell.avgCompletionRate)}`} aria-hidden="true" />
                              <span className="text-sm font-bold tabular-nums text-foreground">
                                {cell.avgCompletionRate}%
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {cell.employeeCount} emp.
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-semibold">{grade.name} × {sl.name}</p>
                          <p>{cell.employeeCount} employees · {cell.totalFormations} formations</p>
                          <p>{cell.completedFormations} completed · {cell.avgCompletionRate}% avg</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
