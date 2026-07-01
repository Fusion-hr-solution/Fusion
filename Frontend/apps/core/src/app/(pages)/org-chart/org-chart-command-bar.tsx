"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  CircleHelp,
  Download,
  ImageDown,
  Loader2,
  LocateFixed,
  Maximize,
  Network,
  PanelLeft,
  Printer,
  Search,
  SlidersHorizontal,
  TreePine,
  Undo2,
  Users,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
  OrgChartLens,
  OrgChartSearchItem,
  OrgUnitSearchItem,
} from "./org-chart.types";

const DEPTH_OPTIONS = [4, 6, 8, 10];

const CHART_GUIDE_ITEMS = [
  {
    label: "Manager inactive",
    variant: "destructive" as const,
    description: "The employee's current manager is inactive and should be replaced.",
  },
  {
    label: "Manager missing",
    variant: "destructive" as const,
    description: "The manager reference no longer resolves in governed employee data.",
  },
  {
    label: "No org unit",
    variant: "outline" as const,
    description: "The employee still needs organization placement in the workforce record.",
  },
  {
    label: "Detached",
    variant: "outline" as const,
    description:
      "Shown at the chart root because the node's visible parent is missing from the current view.",
  },
];

interface OrgChartCommandBarProps {
  lens: OrgChartLens;
  onLensChange: (lens: OrgChartLens) => void;

  peopleSearchIndex: OrgChartSearchItem[];
  unitSearchIndex: OrgUnitSearchItem[];
  onSelectPerson: (employeeId: string) => void;
  onSelectUnit: (unitId: string) => void;

  selectedEmployee: EmployeeOrgChartNodeDto | null;
  focusedRootEmployeeId: string | null;
  hasActiveScope: boolean;
  onFocusSelectedBranch: () => void;
  onShowFullOrganization: () => void;

  canJumpToMe: boolean;
  onJumpToMe: () => void;

  totalVisibleNodeCount: number;
  issueCounts: OrgChartIssueCountsDto | null;
  isBusy: boolean;
  isCanvasReady: boolean;

  selectedOrgUnitCode: string | null;
  onOrgUnitChange: (orgUnitCode: string | null) => void;
  maxDepth: number;
  onMaxDepthChange: (next: number) => void;
  includeInactive: boolean;
  onIncludeInactiveChange: (include: boolean) => void;

  isOutlineOpen: boolean;
  onToggleOutline: () => void;
  onFitToScreen: () => void;
  onResetView: () => void;

  onExportPng: () => void;
  onPrint: () => void;
  isExporting: boolean;

  isReassignMode: boolean;
  onToggleReassignMode: () => void;
  isTenantContextReadOnly?: boolean;
}

export function OrgChartCommandBar({
  lens,
  onLensChange,
  peopleSearchIndex,
  unitSearchIndex,
  onSelectPerson,
  onSelectUnit,
  selectedEmployee,
  focusedRootEmployeeId,
  hasActiveScope,
  onFocusSelectedBranch,
  onShowFullOrganization,
  canJumpToMe,
  onJumpToMe,
  totalVisibleNodeCount,
  issueCounts,
  isBusy,
  isCanvasReady,
  selectedOrgUnitCode,
  onOrgUnitChange,
  maxDepth,
  onMaxDepthChange,
  includeInactive,
  onIncludeInactiveChange,
  isOutlineOpen,
  onToggleOutline,
  onFitToScreen,
  onResetView,
  onExportPng,
  onPrint,
  isExporting,
  isReassignMode,
  onToggleReassignMode,
  isTenantContextReadOnly,
}: OrgChartCommandBarProps) {
  const isPeople = lens === "people";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgUnitOpen, setOrgUnitOpen] = useState(false);
  const [orgUnitSearch, setOrgUnitSearch] = useState("");
  const [orgUnitNameCache, setOrgUnitNameCache] = useState<string | null>(null);

  const { data: orgUnitOptions } = useEmployeeOrgUnitOptions({
    search: orgUnitSearch,
    enabled: isPeople,
  });

  const peopleResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return peopleSearchIndex.slice(0, 8);
    return peopleSearchIndex
      .filter((person) =>
        [person.fullName, person.jobTitle, person.orgUnitName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 8);
  }, [peopleSearchIndex, searchQuery]);

  const unitResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return unitSearchIndex.slice(0, 8);
    return unitSearchIndex
      .filter((unit) =>
        [unit.name, unit.code, unit.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 8);
  }, [unitSearchIndex, searchQuery]);

  const selectedOrgUnitName = useMemo(
    () =>
      orgUnitOptions?.items.find((u) => u.code === selectedOrgUnitCode)?.name ??
      null,
    [orgUnitOptions?.items, selectedOrgUnitCode]
  );
  const displayOrgUnitName =
    selectedOrgUnitName ??
    (selectedOrgUnitCode ? orgUnitNameCache ?? selectedOrgUnitCode : null);

  const totalIssues = issueCounts
    ? issueCounts.noManagerAssigned +
      issueCounts.managerInactive +
      issueCounts.managerMissing +
      issueCounts.missingOrgUnit
    : 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2.5 rounded-2xl border bg-card p-2.5">
        {/* Primary bar */}
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={lens}
            onValueChange={(value) => {
              if (value === "people" || value === "structure") {
                onLensChange(value);
              }
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="people" aria-label="People view">
              <Users />
              People
            </ToggleGroupItem>
            <ToggleGroupItem value="structure" aria-label="Structure view">
              <Network />
              Structure
            </ToggleGroupItem>
          </ToggleGroup>

          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Search />
                {isPeople ? "Find person" : "Find unit"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[24rem] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  placeholder={
                    isPeople
                      ? "Search people in this chart"
                      : "Search org units"
                  }
                />
                <CommandList>
                  <CommandEmpty>
                    {isPeople
                      ? "No matching person in the loaded chart."
                      : "No matching org unit."}
                  </CommandEmpty>
                  {isPeople ? (
                    <CommandGroup heading="People">
                      {peopleResults.map((person) => (
                        <CommandItem
                          key={person.employeeId}
                          value={person.employeeId}
                          onSelect={() => {
                            onSelectPerson(person.employeeId);
                            setSearchQuery("");
                            setSearchOpen(false);
                          }}
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {person.fullName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[person.jobTitle, person.orgUnitName]
                                .filter(Boolean)
                                .join(" • ") || "Employee"}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : (
                    <CommandGroup heading="Org units">
                      {unitResults.map((unit) => (
                        <CommandItem
                          key={unit.orgUnitId}
                          value={unit.orgUnitId}
                          onSelect={() => {
                            onSelectUnit(unit.orgUnitId);
                            setSearchQuery("");
                            setSearchOpen(false);
                          }}
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {unit.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[unit.type, unit.code]
                                .filter(Boolean)
                                .join(" • ")}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {isPeople && canJumpToMe ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onJumpToMe}>
                  <LocateFixed />
                  Find me
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Jump to your position in the chart.
              </TooltipContent>
            </Tooltip>
          ) : null}

          {isPeople ? (
            <Button
              variant="outline"
              size="sm"
              disabled={
                isBusy ||
                !selectedEmployee ||
                selectedEmployee.employeeId === focusedRootEmployeeId
              }
              onClick={onFocusSelectedBranch}
            >
              <TreePine />
              Show this team
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            disabled={isBusy || !hasActiveScope}
            onClick={onShowFullOrganization}
          >
            <Undo2 />
            Whole organization
          </Button>

          <div className="ms-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isOutlineOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={onToggleOutline}
                >
                  <PanelLeft />
                  Outline
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Keyboard-navigable list view of the hierarchy.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isCanvasReady}
                  onClick={onFitToScreen}
                >
                  <Maximize />
                  <span className="sr-only">Fit chart</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Fit chart to screen.</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isCanvasReady || isExporting || totalVisibleNodeCount === 0}
                >
                  <Download />
                  {isExporting ? "Exporting…" : "Export"}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onExportPng}>
                  <ImageDown />
                  Download PNG
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onPrint}>
                  <Printer />
                  Print / Save as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal />
                  <span className="sr-only">More tools</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="include-inactive"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Include inactive people
                  </Label>
                  <Checkbox
                    id="include-inactive"
                    checked={includeInactive}
                    onCheckedChange={(checked) =>
                      onIncludeInactiveChange(checked === true)
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-normal">Depth</Label>
                  <Select
                    value={String(maxDepth)}
                    onValueChange={(value) => onMaxDepthChange(Number(value))}
                  >
                    <SelectTrigger size="sm" className="w-28" aria-label="Chart depth">
                      <SelectValue placeholder="Depth" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {DEPTH_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          Depth {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!isCanvasReady || isBusy}
                  onClick={onResetView}
                >
                  Reset view
                </Button>

                {isPeople && !isTenantContextReadOnly ? (
                  <Button
                    variant={isReassignMode ? "secondary" : "outline"}
                    size="sm"
                    className="w-full"
                    disabled={!isCanvasReady || totalVisibleNodeCount === 0}
                    onClick={onToggleReassignMode}
                  >
                    {isReassignMode ? "Move mode: on" : "Move people by drag"}
                  </Button>
                ) : null}

                <div className="space-y-2 border-t pt-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CircleHelp className="size-3.5" />
                    Badge guide
                  </p>
                  {CHART_GUIDE_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <Badge variant={item.variant} className="shrink-0">
                        {item.label}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Slim status strip */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2.5 text-xs">
          {isPeople ? (
            <Popover open={orgUnitOpen} onOpenChange={setOrgUnitOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedOrgUnitCode ? "secondary" : "outline"}
                  size="sm"
                >
                  <Building2 />
                  {displayOrgUnitName ?? "All org units"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    value={orgUnitSearch}
                    onValueChange={setOrgUnitSearch}
                    placeholder="Search org units"
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
                          value={unit.id}
                          onSelect={() => {
                            onOrgUnitChange(unit.code);
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
          ) : null}

          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Badge variant="outline">
              {totalVisibleNodeCount} {isPeople ? "people" : "units"} shown
            </Badge>
            {isBusy ? (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Updating chart"
              />
            ) : null}
          </span>

          {isPeople && issueCounts && totalIssues > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <AlertTriangle className="size-3.5" />
                  {totalIssues} structure issue{totalIssues === 1 ? "" : "s"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 space-y-2">
                {issueCounts.managerInactive > 0 ? (
                  <IssueRow
                    label="Manager inactive"
                    count={issueCounts.managerInactive}
                    variant="destructive"
                  />
                ) : null}
                {issueCounts.managerMissing > 0 ? (
                  <IssueRow
                    label="Manager missing"
                    count={issueCounts.managerMissing}
                    variant="destructive"
                  />
                ) : null}
                {issueCounts.noManagerAssigned > 0 ? (
                  <IssueRow
                    label="No manager assigned"
                    count={issueCounts.noManagerAssigned}
                    variant="outline"
                  />
                ) : null}
                {issueCounts.missingOrgUnit > 0 ? (
                  <IssueRow
                    label="Missing org unit"
                    count={issueCounts.missingOrgUnit}
                    variant="outline"
                  />
                ) : null}
              </PopoverContent>
            </Popover>
          ) : null}

          {isPeople && selectedEmployee ? (
            <span className="ms-auto flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">Selected</Badge>
              <span className="font-medium text-foreground">
                {selectedEmployee.fullName}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

function IssueRow({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "destructive" | "outline";
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={variant}>{count}</Badge>
    </div>
  );
}
