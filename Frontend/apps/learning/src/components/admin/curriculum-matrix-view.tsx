"use client";

import { useState, useMemo, useCallback } from "react";
import { Grid3X3, Info } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getCurriculumMatrix } from "@/services/admin-service";
import type { AdminCurriculumMatrix, AdminCurriculumCell } from "@/types/admin";
import { CurriculumCellDrawer } from "./curriculum-cell-drawer";

export function CurriculumMatrixView() {
  const fetchMatrix = useCallback(() => getCurriculumMatrix(), []);
  const { data: matrix, isLoading, refetch } = useApiQuery<AdminCurriculumMatrix>(
    fetchMatrix,
    { enabled: true },
  );

  const [openCell, setOpenCell] = useState<{ gradeId: string; serviceLineId: string } | null>(null);

  const cellMap = useMemo(() => {
    const map = new Map<string, AdminCurriculumCell>();
    if (matrix?.cells) {
      for (const cell of matrix.cells) {
        map.set(`${cell.gradeId}:${cell.serviceLineId}`, cell);
      }
    }
    return map;
  }, [matrix]);

  const sortedGrades = useMemo(
    () => matrix?.grades?.slice().sort((a, b) => a.level - b.level) ?? [],
    [matrix],
  );

  const serviceLines = matrix?.serviceLines ?? [];

  const openGrade = sortedGrades.find((g) => g.id === openCell?.gradeId);
  const openSl = serviceLines.find((sl) => sl.id === openCell?.serviceLineId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Curriculum Matrix
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign formations to each grade × service line combination
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading curriculum matrix...
        </div>
      ) : !sortedGrades.length || !serviceLines.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Grid3X3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Create grades and service lines first to build the curriculum matrix
          </p>
        </div>
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                      Grade ↓ / Service Line →
                    </th>
                    {serviceLines.map((sl) => (
                      <th key={sl.id} className="px-4 py-3 text-center font-medium whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <div
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: sl.color }}
                          />
                          <span>{sl.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{sl.code}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedGrades.map((grade) => (
                    <tr key={grade.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium whitespace-nowrap">
                        {grade.name}
                        <span className="ml-1 text-xs text-muted-foreground">L{grade.level}</span>
                      </td>
                      {serviceLines.map((sl) => {
                        const cell = cellMap.get(`${grade.id}:${sl.id}`);
                        const count = cell?.formationCount ?? 0;
                        const required = cell?.isRequiredCount ?? 0;
                        return (
                          <td key={sl.id} className="px-4 py-3 text-center">
                            <button
                              onClick={() => setOpenCell({ gradeId: grade.id, serviceLineId: sl.id })}
                              className="inline-flex flex-col items-center gap-0.5 rounded-md px-3 py-2 transition-colors hover:bg-muted/40 cursor-pointer"
                            >
                              {count > 0 ? (
                                <>
                                  <Badge variant="secondary" className="text-xs tabular-nums">
                                    {count}
                                  </Badge>
                                  {required > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {required} req
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>Click any cell to view, add, or remove formations for that grade × service line combination.</span>
      </div>

      {/* Drawer */}
      {openCell && openGrade && openSl && (
        <CurriculumCellDrawer
          gradeId={openCell.gradeId}
          serviceLineId={openCell.serviceLineId}
          gradeName={openGrade.name}
          serviceLineName={openSl.name}
          onClose={() => setOpenCell(null)}
          onChanged={() => refetch()}
        />
      )}
    </div>
  );
}
