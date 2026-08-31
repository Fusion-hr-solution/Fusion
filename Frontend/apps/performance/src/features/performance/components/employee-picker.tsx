"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search, UserRound } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ds/components/ui/popover";
import { Spinner } from "@repo/ds/components/ui/spinner";
import { cn } from "@repo/ds/lib/utils";
import { useEmployeeSearch } from "../api/use-performance";

export interface PickedEmployee {
  id: string;
  name: string;
  /** Role / org context, shown under the name once a person is chosen. */
  subtitle?: string;
}

export function EmployeePicker({
  value,
  onChange,
  placeholder = "Search people…",
}: {
  value: PickedEmployee | null;
  onChange: (employee: PickedEmployee) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data, isFetching } = useEmployeeSearch(term);
  const items = data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", value && "h-auto py-2")}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserRound className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium text-foreground">{value.name}</span>
                {value.subtitle ? (
                  <span className="block truncate text-xs text-muted-foreground">{value.subtitle}</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 truncate text-muted-foreground">
              <UserRound className="size-3.5" aria-hidden />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Type a name…"
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          {isFetching ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {term.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least two letters to search.</p>
          ) : items.length === 0 && !isFetching ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No people match “{term.trim()}”.</p>
          ) : (
            items.map((employee) => {
              const selected = value?.id === employee.employeeId;
              return (
                <button
                  key={employee.employeeId}
                  type="button"
                  onClick={() => {
                    const subtitle = [employee.jobTitle, employee.orgUnit?.name]
                      .filter(Boolean)
                      .join(" · ");
                    onChange({
                      id: employee.employeeId,
                      name: employee.displayName,
                      subtitle: subtitle || undefined,
                    });
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{employee.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {employee.jobTitle ?? employee.employmentStatus}
                      {employee.orgUnit ? ` · ${employee.orgUnit.name}` : ""}
                    </span>
                  </span>
                  {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
