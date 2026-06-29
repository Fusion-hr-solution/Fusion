"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Skeleton,
} from "@repo/ui";
import { ArrowUpDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import type { CellEmployee } from "@/types/admin";

interface CellDrillDownDialogProps {
  gradeName: string;
  serviceLineName: string;
  open: boolean;
  onClose: () => void;
  employees: CellEmployee[];
  isLoading: boolean;
}

type SortField =
  | "completionPercentage"
  | "completedFormations"
  | "lastActivityAt";

function completionBadge(pct: number) {
  if (pct >= 80)
    return (
      <Badge className="bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))] border-[hsl(var(--ey-green-500))]/30">
        {pct}%
      </Badge>
    );
  if (pct >= 50)
    return (
      <Badge className="bg-[hsl(var(--ey-orange-500))]/10 text-foreground border-[hsl(var(--ey-orange-500))]/30">
        {pct}%
      </Badge>
    );
  return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/30">
      {pct}%
    </Badge>
  );
}

export function CellDrillDownDialog({
  gradeName,
  serviceLineName,
  open,
  onClose,
  employees,
  isLoading,
}: CellDrillDownDialogProps) {
  const t = useTranslations("adminCells");
  const format = useFormatter();
  const [sortField, setSortField] = useState<SortField>("completionPercentage");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!employees) return [];
    return [...employees].sort((a, b) => {
      const aVal =
        sortField === "lastActivityAt"
          ? new Date(a.lastActivityAt ?? 0).getTime()
          : a[sortField];
      const bVal =
        sortField === "lastActivityAt"
          ? new Date(b.lastActivityAt ?? 0).getTime()
          : b[sortField];
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [employees, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {gradeName} × {serviceLineName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("dialog.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">
                    {t("dialog.table.employeeId")}
                  </TableHead>
                  <TableHead className="text-xs">
                    {t("dialog.table.grade")}
                  </TableHead>
                  <TableHead className="text-xs">
                    {t("dialog.table.serviceLine")}
                  </TableHead>
                  <TableHead className="text-xs">
                    <button
                      type="button"
                      onClick={() => toggleSort("completedFormations")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {t("dialog.table.progress")}{" "}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs">
                    <button
                      type="button"
                      onClick={() => toggleSort("completionPercentage")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {t("dialog.table.completion")}{" "}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs">
                    <button
                      type="button"
                      onClick={() => toggleSort("lastActivityAt")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {t("dialog.table.lastActivity")}{" "}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((emp) => (
                  <TableRow key={emp.employeeId} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-mono">
                      {emp.employeeId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-xs">{emp.gradeName}</TableCell>
                    <TableCell className="text-xs">
                      {emp.serviceLineName}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {emp.completedFormations}/{emp.totalFormations}
                    </TableCell>
                    <TableCell>
                      {completionBadge(emp.completionPercentage)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {emp.lastActivityAt
                        ? format.dateTime(new Date(emp.lastActivityAt), {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : t("dialog.noActivity")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
