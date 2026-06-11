"use client";

import { useTranslations } from "next-intl";
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

function cellColor(rate: number): string {
  if (rate >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (rate >= 50) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function cellDot(rate: number): string {
  if (rate >= 80) return "bg-emerald-500";
  if (rate >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function ProgrammeMatrixTable({
  matrix,
  onCellClick,
}: ProgrammeMatrixTableProps) {
  const t = useTranslations("adminCurriculum");
  const { grades, serviceLines, cells } = matrix;

  const cellLookup = new Map(
    cells.map((c) => [`${c.gradeId}:${c.serviceLineId}`, c])
  );

  return (
    <div className="ey-animate-fade-up overflow-x-auto rounded-xl border border-border/60 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="sticky left-0 z-10 bg-muted/40 min-w-[140px] font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              {t("matrix.gradeHeader")}
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
            <TableRow
              key={grade.id}
              className="hover:bg-muted/20 transition-colors"
            >
              <TableCell className="sticky left-0 z-10 bg-white font-medium text-sm">
                {grade.name}
              </TableCell>
              {serviceLines.map((sl) => {
                const cell = cellLookup.get(`${grade.id}:${sl.id}`);
                if (!cell || cell.employeeCount === 0) {
                  return (
                    <TableCell key={sl.id} className="text-center">
                      <span className="text-xs text-muted-foreground/50">
                        —
                      </span>
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
                          className={`inline-flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer ${cellColor(cell.avgCompletionRate)}`}
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${cellDot(cell.avgCompletionRate)}`}
                            />
                            <span className="text-sm font-bold tabular-nums">
                              {cell.avgCompletionRate}%
                            </span>
                          </div>
                          <span className="text-[10px] opacity-70">
                            {t("matrix.employeesShort", {
                              count: cell.employeeCount,
                            })}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-semibold">
                          {grade.name} × {sl.name}
                        </p>
                        <p>
                          {t("matrix.tooltipCounts", {
                            employees: cell.employeeCount,
                            formations: cell.totalFormations,
                          })}
                        </p>
                        <p>
                          {t("matrix.tooltipCompletion", {
                            completed: cell.completedFormations,
                            avg: cell.avgCompletionRate,
                          })}
                        </p>
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
  );
}
