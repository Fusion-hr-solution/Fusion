"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { SEARCH_DEBOUNCE_MS } from "@repo/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmployeeRosterStatus } from "./employee-roster.types";

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: EmployeeRosterStatus | undefined;
  onStatusChange: (value: EmployeeRosterStatus | undefined) => void;
}

export function Toolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: ToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const hasFilters = localSearch.trim().length > 0 || !!status;

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
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder="Search by name or email"
          className="pl-8"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={status ?? "all"}
          onValueChange={(value) =>
            onStatusChange(
              value === "all" ? undefined : (value as EmployeeRosterStatus)
            )
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalSearch("");
              onSearchChange("");
              onStatusChange(undefined);
            }}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}