"use client";

import { useMemo, useState } from "react";
import {
  CircleHelp,
  LocateFixed,
  Maximize,
  Search,
  TreePine,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import type {
  EmployeeOrgChartNodeDto,
  OrgChartSearchItem,
} from "./org-chart.types";

const DEPTH_OPTIONS = [4, 6, 8, 10];

const CHART_GUIDE_ITEMS = [
  {
    label: "Needs reassignment",
    variant: "destructive" as const,
    description: "The employee's current manager is inactive and should be replaced.",
  },
  {
    label: "Needs attention",
    variant: "destructive" as const,
    description: "The manager reference no longer resolves in governed employee data.",
  },
  {
    label: "Detached branch",
    variant: "outline" as const,
    description: "This branch is shown at the chart root because its visible manager is missing from the current chart.",
  },
];

interface OrgChartToolbarProps {
  searchIndex: OrgChartSearchItem[];
  selectedEmployee: EmployeeOrgChartNodeDto | null;
  focusedRootEmployeeId: string | null;
  maxDepth: number;
  totalVisibleNodeCount: number;
  isRefreshing: boolean;
  onMaxDepthChange: (nextDepth: number) => void;
  onSelectSearchResult: (employeeId: string) => void;
  onFocusSelectedBranch: () => void;
  onShowFullOrganization: () => void;
  onFitToScreen: () => void;
  onResetView: () => void;
}

export function OrgChartToolbar({
  searchIndex,
  selectedEmployee,
  focusedRootEmployeeId,
  maxDepth,
  totalVisibleNodeCount,
  isRefreshing,
  onMaxDepthChange,
  onSelectSearchResult,
  onFocusSelectedBranch,
  onShowFullOrganization,
  onFitToScreen,
  onResetView,
}: OrgChartToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
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
                  <CommandEmpty>No matching employee in the loaded chart.</CommandEmpty>
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
                          <span className="truncate font-medium">{employee.fullName}</span>
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
            disabled={!selectedEmployee || selectedEmployee.employeeId === focusedRootEmployeeId}
            onClick={onFocusSelectedBranch}
          >
            <TreePine />
            Focus selected branch
          </Button>

          <Button
            variant="outline"
            disabled={focusedRootEmployeeId === null}
            onClick={onShowFullOrganization}
          >
            <Undo2 />
            Return to overview
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge variant="outline">{totalVisibleNodeCount} loaded</Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Loaded people in the current chart query. Collapsing a branch only hides it locally.
            </TooltipContent>
          </Tooltip>
          {isRefreshing ? <Badge variant="secondary">Refreshing</Badge> : null}

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
                  Use these badges to spot reporting problems without leaving the chart.
                </p>
              </div>
              <div className="space-y-2">
                {CHART_GUIDE_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
                    <Badge variant={item.variant}>{item.label}</Badge>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={String(maxDepth)}
            onValueChange={(value) => onMaxDepthChange(Number(value))}
          >
            <SelectTrigger size="sm" aria-label="Select chart depth">
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onFitToScreen}>
                <Maximize />
                Fit full chart
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Zoom out to include every loaded node. On large orgs, use Reset view to return to the readable overview.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onResetView}>
                <LocateFixed />
                Reset view
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Return to the default overview or focused-branch starting view.
            </TooltipContent>
          </Tooltip>
        </div>

        {selectedEmployee ? (
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-sm">
            <Badge variant="secondary">Selected</Badge>
            <span className="font-medium">{selectedEmployee.fullName}</span>
            <span className="text-muted-foreground">
              {selectedEmployee.managerName
                ? `Reports to ${selectedEmployee.managerName}`
                : "Top-level leader"}
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