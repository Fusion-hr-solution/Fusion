"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Building2, ListFilter, Search, UserRound, X } from "lucide-react";
import { SEARCH_DEBOUNCE_MS } from "@repo/ui";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMPLOYEE_ACCESS_FILTER_OPTIONS } from "@/features/access/shared/employee-access";
import {
  useEmployeeManagerOptions,
  useEmployeeOrgUnitOptions,
} from "./use-employees";
import { EMPLOYEE_READINESS_FILTER_OPTIONS } from "./employee-readiness";
import type {
  EmployeeAccessFilter,
  EmployeeOrgUnitOption,
  EmployeeReadinessFilter,
  EmployeeRosterItem,
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
  orgUnitId: string | undefined;
  selectedOrgUnitName: string | null;
  onOrgUnitChange: (value: string | undefined, label?: string | null) => void;
  orgUnitSeedOptions: EmployeeOrgUnitOption[];
  managerId: string | undefined;
  selectedManagerName: string | null;
  onManagerChange: (value: string | undefined, label?: string | null) => void;
  managerSeedOptions: EmployeeRosterItem[];
  access: EmployeeAccessFilter | undefined;
  onAccessChange: (value: EmployeeAccessFilter | undefined) => void;
  readiness: EmployeeReadinessFilter | undefined;
  onReadinessChange: (value: EmployeeReadinessFilter | undefined) => void;
  onClearFilters: () => void;
}

function getOrgUnitDisplayLabel(option: EmployeeOrgUnitOption) {
  return option.code ? `${option.name} · ${option.code}` : option.name;
}

function getManagerDisplayName(employee: EmployeeRosterItem) {
  return employee.displayName?.trim() || `${employee.firstName} ${employee.lastName}`;
}

export function Toolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  orgUnitId,
  selectedOrgUnitName,
  onOrgUnitChange,
  orgUnitSeedOptions,
  managerId,
  selectedManagerName,
  onManagerChange,
  managerSeedOptions,
  access,
  onAccessChange,
  readiness,
  onReadinessChange,
  onClearFilters,
}: ToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [orgUnitSearch, setOrgUnitSearch] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [isOrgUnitOpen, setIsOrgUnitOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const deferredManagerSearch = useDeferredValue(managerSearch);
  const selectedAccessOption = access
    ? EMPLOYEE_ACCESS_FILTER_OPTIONS.find((option) => option.value === access)
    : null;
  const selectedReadinessOption = readiness
    ? EMPLOYEE_READINESS_FILTER_OPTIONS.find(
        (option) => option.value === readiness
      )
    : null;
  const hasFilters =
    localSearch.trim().length > 0 ||
    !!status ||
    !!orgUnitId ||
    !!managerId ||
    !!access ||
    !!readiness;
  const managerOptionsQuery = useEmployeeManagerOptions({
    employeeId: null,
    search: deferredManagerSearch,
    enabled: true,
  });
  const managerOptions = useMemo(() => {
    const options = new Map<string, EmployeeRosterItem>();

    for (const manager of managerSeedOptions) {
      options.set(manager.id, manager);
    }

    for (const manager of managerOptionsQuery.data?.items ?? []) {
      if (manager.directReportCount > 0) {
        options.set(manager.id, manager);
      }
    }

    return [...options.values()].sort((left, right) => {
      const byName = getManagerDisplayName(left).localeCompare(
        getManagerDisplayName(right)
      );

      return byName !== 0 ? byName : left.email.localeCompare(right.email);
    });
  }, [managerOptionsQuery.data?.items, managerSeedOptions]);
  const orgUnitOptionsQuery = useEmployeeOrgUnitOptions({
    search: orgUnitSearch,
    enabled: true,
  });
  const orgUnitOptions = useMemo(() => {
    const options = new Map<string, EmployeeOrgUnitOption>();

    for (const orgUnit of orgUnitSeedOptions) {
      options.set(orgUnit.id, orgUnit);
    }

    for (const orgUnit of orgUnitOptionsQuery.data?.items ?? []) {
      options.set(orgUnit.id, orgUnit);
    }

    return [...options.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [orgUnitOptionsQuery.data?.items, orgUnitSeedOptions]);

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
      <div className="relative min-w-[16rem] max-w-md flex-[1_1_18rem]">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Search name or email"
          className="pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={status ? "secondary" : "outline"} size="sm" className="gap-1">
            <ListFilter className="size-3.5" />
            {status ?? "Status"}
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

      <Popover open={isOrgUnitOpen} onOpenChange={setIsOrgUnitOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={orgUnitId ? "secondary" : "outline"}
            size="sm"
            className="max-w-[13rem] justify-start gap-1"
          >
            <Building2 className="size-3.5" />
            <span className="truncate">{selectedOrgUnitName ?? "Org unit"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[18rem] p-0">
          <Command>
            <CommandInput
              value={orgUnitSearch}
              onValueChange={setOrgUnitSearch}
              placeholder="Search org units"
            />
            <CommandList>
              <CommandEmpty>No org units found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__all_org_units__"
                  onSelect={() => {
                    onOrgUnitChange(undefined, null);
                    setIsOrgUnitOpen(false);
                    setOrgUnitSearch("");
                  }}
                >
                  All org units
                </CommandItem>
                {orgUnitOptions.map((orgUnit) => (
                  <CommandItem
                    key={orgUnit.id}
                    value={getOrgUnitDisplayLabel(orgUnit)}
                    onSelect={() => {
                      onOrgUnitChange(orgUnit.id, orgUnit.name);
                      setIsOrgUnitOpen(false);
                      setOrgUnitSearch("");
                    }}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{orgUnit.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[orgUnit.code, orgUnit.type].filter(Boolean).join(" • ") ||
                          "Current roster"}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={isManagerOpen} onOpenChange={setIsManagerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={managerId ? "secondary" : "outline"}
            size="sm"
            className="max-w-[13rem] justify-start gap-1"
          >
            <UserRound className="size-3.5" />
            <span className="truncate">{selectedManagerName ?? "Manager"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[18rem] p-0">
          <Command>
            <CommandInput
              value={managerSearch}
              onValueChange={setManagerSearch}
              placeholder="Search managers"
            />
            <CommandList>
              <CommandEmpty>No managers found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__all_managers__"
                  onSelect={() => {
                    onManagerChange(undefined, null);
                    setIsManagerOpen(false);
                    setManagerSearch("");
                  }}
                >
                  All managers
                </CommandItem>
                {managerOptions.map((manager) => (
                  <CommandItem
                    key={manager.id}
                    value={`${getManagerDisplayName(manager)} ${manager.email}`}
                    onSelect={() => {
                      onManagerChange(manager.id, getManagerDisplayName(manager));
                      setIsManagerOpen(false);
                      setManagerSearch("");
                    }}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {getManagerDisplayName(manager)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {manager.email}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={access ? "secondary" : "outline"} size="sm" className="gap-1">
            <ListFilter className="size-3.5" />
            {selectedAccessOption ? selectedAccessOption.label : "Access"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter access state</DropdownMenuLabel>
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
          <Button variant={readiness ? "secondary" : "outline"} size="sm" className="gap-1">
            <ListFilter className="size-3.5" />
            {selectedReadinessOption ? selectedReadinessOption.label : "Record completeness"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter record completeness</DropdownMenuLabel>
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
              All records
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
            setOrgUnitSearch("");
            setManagerSearch("");
            onClearFilters();
          }}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
