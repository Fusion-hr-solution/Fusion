"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SEARCH_DEBOUNCE_MS } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;
}

export function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: ToolbarProps) {
  const hasFilters = statusFilter.length > 0;

  // Local input state + debounce before pushing upstream
  const [localSearch, setLocalSearch] = useState(search);

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
  }, [localSearch, search, onSearchChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search organizations…"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <Select
        value={statusFilter.length === 1 ? statusFilter[0] : ""}
        onValueChange={(v) => {
          if (v) {
            onStatusFilterChange([v]);
          }
        }}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onStatusFilterChange([]);
          }}
        >
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
