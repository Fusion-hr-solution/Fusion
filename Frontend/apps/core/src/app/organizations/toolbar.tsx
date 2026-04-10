"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  attentionFilter: boolean | undefined;
  onAttentionFilterChange: (value: boolean | undefined) => void;
}

export function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  attentionFilter,
  onAttentionFilterChange,
}: ToolbarProps) {
  const hasFilters = statusFilter.length > 0 || attentionFilter !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search organizations…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
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

      <Button
        variant={attentionFilter ? "secondary" : "outline"}
        size="sm"
        onClick={() =>
          onAttentionFilterChange(attentionFilter === true ? undefined : true)
        }
      >
        Needs Attention
        {attentionFilter && (
          <Badge variant="secondary" className="ml-1 size-4 justify-center p-0 text-[10px]">
            !
          </Badge>
        )}
      </Button>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onStatusFilterChange([]);
            onAttentionFilterChange(undefined);
          }}
        >
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
