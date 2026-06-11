"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CircleHelp,
  LocateFixed,
  Maximize,
  Search,
  TreePine,
  Undo2,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEmployeeOrgUnitOptions } from "../employees/use-employees";
import type {
  EmployeeOrgChartNodeDto,
  OrgChartIssueCountsDto,
  OrgChartSearchItem,
} from "./org-chart.types";

const DEPTH_OPTIONS = [4, 6, 8, 10];

const CHART_GUIDE_ITEMS = [
  {
    label: "Needs reassignment",
    variant: "destructive" as const,
    description:
      "The employee's current manager is inactive and should be replaced.",
  },
  {
    label: "Needs attention",
    variant: "destructive" as const,
    description:
      "The manager reference no longer resolves in governed employee data.",
  },
  {
    label: "Missing org unit",
    variant: "outline" as const,
    description:
      "The employee still needs organization placement in the workforce record.",
  },
  {
    label: "Detached branch",
    variant: "outline" as const,
    description:
      "This branch is shown at the chart root because its visible manager is missing from the current chart.",
  },
];

interface OrgChartToolbarProps {
  searchIndex: OrgChartSearchItem[];
  selectedEmployee: EmployeeOrgChartNodeDto | null;
  focusedRootEmployeeId: string | null;
  focusEmployeeId: string | null;
  maxDepth: number;
  totalVisibleNodeCount: number;
  isCanvasReady: boolean;
  isNavigating: boolean;
  isReassignMode: boolean;
  isRefreshing: boolean;
  includeInactive: boolean;
  selectedOrgUnitId: string | null;
  issueCounts: OrgChartIssueCountsDto | null;
  onMaxDepthChange: (nextDepth: number) => void;
  onSelectSearchResult: (employeeId: string) => void;
  onFocusSelectedBranch: () => void;
  onShowFullOrganization: () => void;
  onToggleReassignMode: () => void;
  onFitToScreen: () => void;
  onResetView: () => void;
  onIncludeInactiveChange: (include: boolean) => void;
  onOrgUnitChange: (orgUnitId: string | null) => void;
  isTenantContextReadOnly?: boolean;
}

export function OrgChartToolbar({
  searchIndex,
  selectedEmployee,
  focusedRootEmployeeId,
  focusEmployeeId,
  maxDepth,
  totalVisibleNodeCount,
  isCanvasReady,
  isNavigating,
  isReassignMode,
  isRefreshing,
  includeInactive,
  selectedOrgUnitId,
  issueCounts,
  onMaxDepthChange,
  onSelectSearchResult,
  onFocusSelectedBranch,
  onShowFullOrganization,
  isTenantContextReadOnly,
  onToggleReassignMode,
  onFitToScreen,
  onResetView,
  onIncludeInactiveChange,
  onOrgUnitChange,
}: OrgChartToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgUnitOpen, setOrgUnitOpen] = useState(false);
  const [orgUnitSearch, setOrgUnitSearch] = useState("");
  // Cache the selected org unit name so it remains visible when the user types
  // a different search term and the selected unit is no longer in the results page.
  const [orgUnitNameCache, setOrgUnitNameCache] = useState<string | null>(null);

  const { data: orgUnitOptions } = useEmployeeOrgUnitOptions({
    search: orgUnitSearch,
  });

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return searchIndex.slice(0, 8);
    }

    return searchIndex
      .filter((employee) => {
        const haystack = [
          employee.fullName,
          employee.jobTitle,
          employee.orgUnitName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [searchIndex, searchQuery]);

  const selectedOrgUnitName = useMemo(
    () =>
      orgUnitOptions?.items.find((u) => u.id === selectedOrgUnitId)?.name ??
      null,
    [orgUnitOptions?.items, selectedOrgUnitId]
  );

  // Prefer the name resolved from the current results page; fall back to the cached
  // name from when the user last made a selection (covers the case where the selected
  // unit has scrolled/searched out of the current results page).
  const displayOrgUnitName =
    selectedOrgUnitName ?? (selectedOrgUnitId ? orgUnitNameCache : null);

  const totalIssues = issueCounts
    ? issueCounts.noManagerAssigned +
      issueCounts.managerInactive +
      issueCounts.managerMissing +
      issueCounts.missingOrgUnit
    : 0;
  const isBusy = isNavigating || isRefreshing;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Search />
                Find person
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[24rem] p-0">
              <Command>
                <CommandInput
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  placeholder="Search loaded chart"
                />
                <CommandList>
                  <CommandEmpty>
                    No matching employee in the loaded chart.
                  </CommandEmpty>
                  <CommandGroup heading="People">
                    {searchResults.map((employee) => (
                      <CommandItem
                        key={employee.employeeId}
                        value={`${employee.fullName} ${employee.jobTitle ?? ""} ${employee.orgUnitName ?? ""}`}
                        onSelect={() => {
                          onSelectSearchResult(employee.employeeId);
                          setSearchQuery("");
                          setSearchOpen(false);
                        }}
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">
                            {employee.fullName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {[employee.jobTitle, employee.orgUnitName]
                              .filter(Boolean)
                              .join(" • ") || "Employee summary"}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            disabled={
              isBusy ||
              !selectedEmployee ||
              selectedEmployee.employeeId === focusedRootEmployeeId
            }
            onClick={onFocusSelectedBranch}
          >
            <TreePine />
            Focus selected branch
          </Button>

          <Button
            variant="outline"
            disabled={
              isBusy ||
              (focusedRootEmployeeId === null &&
                selectedOrgUnitId === null &&
                focusEmployeeId === null)
            }
            onClick={onShowFullOrganization}
          >
            <Undo2 />
            Return to overview
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={orgUnitOpen} onOpenChange={setOrgUnitOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedOrgUnitId ? "secondary" : "outline"}
                  size="sm"
                >
                  <Building2 />
                  {displayOrgUnitName ?? "All org units"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-0">
                <Command>
                  <CommandInput
                    value={orgUnitSearch}
                    onValueChange={setOrgUnitSearch}
                    placeholder="Search org units…"
                  />
                  <CommandList>
                    <CommandEmpty>No org units found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__"
                        onSelect={() => {
                          onOrgUnitChange(null);
                          setOrgUnitNameCache(null);
                          setOrgUnitOpen(false);
                        }}
                      >
                        All org units
                      </CommandItem>
                      {orgUnitOptions?.items.map((unit) => (
                        <CommandItem
                          key={unit.id}
                          value={unit.name}
                          onSelect={() => {
                            onOrgUnitChange(unit.id);
                            setOrgUnitNameCache(unit.name);
                            setOrgUnitOpen(false);
                          }}
                        >
                          {unit.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 rounded-md border px-2 py-1">
              <Checkbox
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={(checked) =>
                  onIncludeInactiveChange(checked === true)
                }
              />
              <Label htmlFor="include-inactive" className="cursor-pointer text-sm">
                Include inactive
              </Label>
            </div>

            <Select
              value={String(maxDepth)}
              onValueChange={(value) => onMaxDepthChange(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="Select chart depth">
                <SelectValue placeholder="Depth" />
              </SelectTrigger>
              <SelectContent align="start">
                {DEPTH_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    Depth {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isReassignMode ? "secondary" : "outline"}
                  size="sm"
                  disabled={
                    !isCanvasReady || totalVisibleNodeCount === 0 || isTenantContextReadOnly
                  }
                  onClick={onToggleReassignMode}
                >
                  <ArrowRightLeft />
                  {isReassignMode ? "Reassign mode on" : "Reassign by drag"}
                </Button>
              </TooltipTrigger>
              {isTenantContextReadOnly ? (
                <TooltipContent side="bottom">
                  Reassignment is not available in read-only mode.
                </TooltipContent>
              ) : null}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onFitToScreen}>
                  <Maximize />
                  Fit full chart
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Zoom out to include every loaded node.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isCanvasReady || isBusy}
                  onClick={onResetView}
                >
                  <LocateFixed />
                  Reset view
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Return to the default overview or focused-branch starting view.
              </TooltipContent>
            </Tooltip>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CircleHelp />
                  Chart guide
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Chart guide</p>
                  <p className="text-sm text-muted-foreground">
                    Use these badges to spot reporting problems without leaving
                    the chart.
                  </p>
                </div>
                <div className="space-y-2">
                  {CHART_GUIDE_ITEMS.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <Badge variant={item.variant}>{item.label}</Badge>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {isBusy ? (
              <Badge variant="secondary">
                {isNavigating ? "Updating chart" : "Refreshing"}
              </Badge>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge variant="outline">{totalVisibleNodeCount} loaded</Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Loaded people in the current chart query. Collapsing a branch
                only hides it locally.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {isReassignMode ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
            <Badge variant="secondary">Reassign mode</Badge>
            <span>Drag one employee onto the new manager.</span>
          </div>
        ) : null}

        {/* Row 2: issue buckets (only shown when there are issues) */}
        {issueCounts && totalIssues > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5" />
              Structure issues:
            </span>
            {issueCounts.noManagerAssigned > 0 ? (
              <Badge variant="outline" className="cursor-default gap-1.5">
                <UserX className="size-3" />
                No manager assigned ({issueCounts.noManagerAssigned})
              </Badge>
            ) : null}
            {issueCounts.managerInactive > 0 ? (
              <Badge variant="destructive" className="cursor-default gap-1.5">
                Needs reassignment ({issueCounts.managerInactive})
              </Badge>
            ) : null}
            {issueCounts.managerMissing > 0 ? (
              <Badge variant="destructive" className="cursor-default gap-1.5">
                Needs attention ({issueCounts.managerMissing})
              </Badge>
            ) : null}
            {issueCounts.missingOrgUnit > 0 ? (
              <Badge variant="outline" className="cursor-default gap-1.5">
                Missing org unit ({issueCounts.missingOrgUnit})
              </Badge>
            ) : null}
          </div>
        ) : null}

        {/* Row 3: selected employee summary */}
        {selectedEmployee ? (
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-sm">
            <Badge variant="secondary">Selected</Badge>
            <span className="font-medium">{selectedEmployee.fullName}</span>
            <span className="text-muted-foreground">
              {selectedEmployee.managerName
                ? `Reports to ${selectedEmployee.managerName}`
                : selectedEmployee.hierarchyStatus === "Root"
                  ? "Top-level leader"
                  : "No manager assigned"}
            </span>
            <span className="text-muted-foreground">
              {selectedEmployee.directReportCount > 0
                ? `${selectedEmployee.directReportCount} direct reports`
                : "No direct reports"}
            </span>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
