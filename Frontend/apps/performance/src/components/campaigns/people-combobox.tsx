"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  type PagedResponse,
  type WorkforceEmployeeSummaryDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PersonOption = {
  employeeId: string;
  displayName: string;
  jobTitle: string | null;
  orgUnitName: string | null;
};

/**
 * A bounded picker over active Core employees (choices, never free text). Searches the Core
 * workforce contract via the gateway; selecting emits the resolved person to the caller.
 */
export function PeopleCombobox({
  value,
  onSelect,
  placeholder = "Search people…",
  disabled,
  excludeIds,
  align = "start",
}: {
  value?: PersonOption | null;
  onSelect: (person: PersonOption) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeIds?: readonly string[];
  align?: "start" | "end";
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useApiQuery<PagedResponse<WorkforceEmployeeSummaryDto>>(
    coreWorkforceQueryKeys.search({ search, page: 1, pageSize: 10 }),
    (signal) =>
      apiClient.get<PagedResponse<WorkforceEmployeeSummaryDto>>(coreWorkforcePaths.search(), {
        signal,
        params: { search: search || undefined, page: 1, pageSize: 10 },
      }),
    { enabled: open },
  );

  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const options = (data?.items ?? [])
    .filter((employee) => employee.isActive && !excluded.has(employee.employeeId))
    .map<PersonOption>((employee) => ({
      employeeId: employee.employeeId,
      displayName: employee.displayName || employee.fullName,
      jobTitle: employee.jobTitle,
      orgUnitName: employee.orgUnit?.name ?? null,
    }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.displayName : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[--radix-popover-trigger-width] min-w-64 p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search by name or email"
              className="h-10 border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</div>
            ) : (
              <CommandEmpty>No matching people.</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((person) => (
                <CommandItem
                  key={person.employeeId}
                  value={person.employeeId}
                  onSelect={() => {
                    onSelect(person);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value?.employeeId === person.employeeId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{person.displayName}</span>
                    {person.jobTitle || person.orgUnitName ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[person.jobTitle, person.orgUnitName].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
