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
import { EMPLOYEE_ACCESS_FILTER_OPTIONS } from "./employee-access";
import { EMPLOYEE_READINESS_FILTER_OPTIONS } from "./employee-readiness";
import type {
  EmployeeAccessFilter,
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
  access: EmployeeAccessFilter | undefined;
  onAccessChange: (value: EmployeeAccessFilter | undefined) => void;
  readiness: EmployeeReadinessFilter | undefined;
  onReadinessChange: (value: EmployeeReadinessFilter | undefined) => void;
}

function ActiveFilterBadge() {
  return (
    <Badge
      variant="secondary"
      className="ml-1 rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wide"
    >
      On
    </Badge>
  );
}

export function Toolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  access,
  onAccessChange,
  readiness,
  onReadinessChange,
}: ToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const selectedAccessOption = access
    ? EMPLOYEE_ACCESS_FILTER_OPTIONS.find((option) => option.value === access)
    : null;
  const hasFilters =
    localSearch.trim().length > 0 || !!status || !!access || !!readiness;

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
      <div className="relative min-w-50 max-w-sm flex-1">
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
            {status ? <ActiveFilterBadge /> : null}
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
            {selectedAccessOption
              ? `Access: ${selectedAccessOption.label}`
              : "Access"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter platform access state</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={access ?? "all"}
            onValueChange={(value) =>
              onAccessChange(
                value === "all" ? undefined : (value as EmployeeAccessFilter)
              )
            }
          >
            <DropdownMenuRadioItem value="all">
              All access states
            </DropdownMenuRadioItem>
            {EMPLOYEE_ACCESS_FILTER_OPTIONS.map((option) => (
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
            {readiness ? <ActiveFilterBadge /> : null}
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
            onAccessChange(undefined);
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
