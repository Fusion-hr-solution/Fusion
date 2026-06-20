"use client";

import { Building2, Layers, TreePine, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeeRoster } from "../employees/use-employees";
import type { OrgUnitTreeNodeDto } from "./org-chart.types";

interface OrgUnitPreviewPanelProps {
  unit: OrgUnitTreeNodeDto | null;
  onClose: () => void;
  onFocusBranch: (unitId: string) => void;
  onViewPeopleInUnit: (unitCode: string) => void;
}

export function OrgUnitPreviewPanel({
  unit,
  onClose,
  onFocusBranch,
  onViewPeopleInUnit,
}: OrgUnitPreviewPanelProps) {
  // Member count is loaded lazily from the roster total for the selected unit. Server-side
  // counts on the org-unit tree are deferred (see .local-docs/core/audits/deferred.md).
  const { data: memberPage, isLoading } = useEmployeeRoster({
    orgUnitCode: unit?.code ?? undefined,
    page: 1,
    pageSize: 1,
    sortBy: "Name",
    sortDir: "Asc",
  });

  if (!unit) return null;

  const subUnitCount = unit.children.length;

  return (
    <div className="flex h-full w-80 flex-col overflow-y-auto bg-card">
      <div className="flex shrink-0 items-start gap-3 border-b p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{unit.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {unit.type}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {unit.isOrphaned ? (
        <div className="shrink-0 px-4 pt-3">
          <Badge variant="outline">Detached</Badge>
        </div>
      ) : null}

      <div className="grid shrink-0 grid-cols-2 gap-2 px-4 py-3">
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          {isLoading ? (
            <Skeleton className="h-6 w-10" />
          ) : (
            <p className="text-lg font-semibold leading-none">
              {memberPage?.totalCount ?? "—"}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Members</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-lg font-semibold leading-none">{subUnitCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sub-units</p>
        </div>
      </div>

      <div className="shrink-0 space-y-2 px-4 pb-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 shrink-0" />
          <span className="truncate font-mono text-xs uppercase tracking-wide">
            {unit.code}
          </span>
        </div>
      </div>

      <Separator />

      <div className="flex shrink-0 flex-col gap-0.5 p-3">
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
          onClick={() => onViewPeopleInUnit(unit.code)}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">View people in this unit</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Switch to the people view, filtered to this unit
            </p>
          </div>
        </button>

        {subUnitCount > 0 ? (
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
            onClick={() => onFocusBranch(unit.id)}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <TreePine className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">Focus this branch</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Show this unit and its sub-units only
              </p>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
