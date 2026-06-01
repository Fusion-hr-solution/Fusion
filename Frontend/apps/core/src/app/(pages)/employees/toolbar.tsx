"use client";

import { useEffect, useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { SEARCH_DEBOUNCE_MS } from "@repo/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  EMPLOYEE_READINESS_FILTER_OPTIONS,
} from "./employee-readiness";
import type {
  EmployeeReadinessFilter,
  EmployeeRosterStatus,
} from "./employee-roster.types";

const STATUS_OPTIONS: Array<{
  value: EmployeeRosterStatus;
  label: string;
}> = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: EmployeeRosterStatus | undefined;
  onStatusChange: (value: EmployeeRosterStatus | undefined) => void;
  readiness: EmployeeReadinessFilter | undefined;
  onReadinessChange: (value: EmployeeReadinessFilter | undefined) => void;
}

export function Toolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  readiness,
  onReadinessChange,
}: ToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const hasFilters = localSearch.trim().length > 0 || !!status || !!readiness;
  const activeFilterCount = (status ? 1 : 0) + (readiness ? 1 : 0);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, search]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] max-w-sm flex-1">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Search by name or email"
          className="pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1">
            <ListFilter className="size-3.5" />
            Status
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter roster status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={status ?? "all"}
            onValueChange={(value) =>
              onStatusChange(
                value === "all" ? undefined : (value as EmployeeRosterStatus)
              )
            }
          >
            <DropdownMenuRadioItem value="all">
              All statuses
            </DropdownMenuRadioItem>
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1">
            <ListFilter className="size-3.5" />
            Needs attention
            {readiness ? (
              <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
                1
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter needs-attention state</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={readiness ?? "all"}
            onValueChange={(value) =>
              onReadinessChange(
                value === "all" ? undefined : (value as EmployeeReadinessFilter)
              )
            }
          >
            <DropdownMenuRadioItem value="all">
              All needs-attention states
            </DropdownMenuRadioItem>
            {EMPLOYEE_READINESS_FILTER_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLocalSearch("");
            onSearchChange("");
            onStatusChange(undefined);
            onReadinessChange(undefined);
          }}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
