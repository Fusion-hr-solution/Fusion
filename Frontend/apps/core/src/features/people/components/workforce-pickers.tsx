"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  cn,
} from "@repo/ds";
import { StatusBadge } from "@repo/ds/shell";
import type { ManagerOptionDto, OrganizationHierarchyNodeDto } from "@repo/api";
import { Building2, Check, ChevronDown, Search } from "lucide-react";
import { OrganizationTree } from "@/features/organization/components/organization-tree";
import { EmployeeIdentity, Monogram, OrgPath } from "./workforce-ui";

/**
 * Shared Workforce picker grammar reused by establishment and temporal maintenance:
 * the canonical Organization hierarchy picker and the human Manager picker. Keeping
 * one implementation here prevents a second Organization dropdown or manager-search
 * pattern from drifting into the product.
 */

export type OrgChoice = { id: string; name: string; path: string; depth: number };

export function flattenOrg(nodes: OrganizationHierarchyNodeDto[], depth = 0): OrgChoice[] {
  return nodes.flatMap((node) => [
    { id: node.unit.id, name: node.unit.name, path: node.unit.path, depth },
    ...flattenOrg(node.children, depth + 1),
  ]);
}

/** Compact two-option segmented control — a mode choice, not two large cards. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="cursor-pointer rounded-lg px-3.5 py-1.5 type-label text-muted-foreground transition-colors has-data-[state=checked]:bg-background has-data-[state=checked]:text-foreground has-data-[state=checked]:shadow-sm focus-within:ring-2 focus-within:ring-ring motion-reduce:transition-none"
        >
          <RadioGroupItem value={option.value} className="sr-only" />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  );
}

export function OrganizationPicker({
  roots,
  value,
  onChange,
  invalid,
}: {
  roots: OrganizationHierarchyNodeDto[];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => flattenOrg(roots).find((choice) => choice.id === value), [roots, value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-invalid={invalid} className={cn("h-auto min-h-11 w-full justify-between py-2 font-normal", selected && "border-foreground/25")}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            {selected ? (
              <OrgPath name={selected.name} path={selected.path} className="text-left" showAncestry={false} />
            ) : (
              <span className="text-muted-foreground">Select organization</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-0">
        <OrganizationTree
          roots={roots}
          selectedId={value || null}
          onSelect={(id) => {
            if (id) {
              onChange(id);
              setOpen(false);
            }
          }}
          emptyLabel="No valid unit on this date"
        />
      </PopoverContent>
    </Popover>
  );
}

export function ManagerPicker({
  options,
  value,
  onChange,
  loading,
  invalid,
}: {
  options: ManagerOptionDto[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  invalid: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.employeeId === value);
  const visible = options.filter((option) =>
    !query.trim() || `${option.displayName} ${option.employeeNumber} ${option.organizationPath}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-invalid={invalid} className={cn("h-auto min-h-11 w-full justify-between py-2 font-normal", selected && "border-foreground/25")}>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Monogram name={selected.displayName} size="sm" />
              <span className="min-w-0 text-left">
                <span className="block truncate type-label">{selected.displayName}</span>
                <span className="block truncate type-meta text-muted-foreground">{selected.jobTitle}</span>
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Search for a manager</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(34rem,calc(100vw-2rem))] p-0">
        <div className="relative border-b p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Employee Number, or email" aria-label="Search managers" className="pl-9" />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <div className="space-y-2 p-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : visible.map((option) => (
            <button
              type="button"
              key={option.employeeId}
              onClick={() => onChange(option.employeeId)}
              aria-pressed={value === option.employeeId}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted"
            >
              <EmployeeIdentity
                name={option.displayName}
                employeeNumber={option.employeeNumber}
                secondary={`${option.jobTitle} · ${option.organizationName}`}
              />
              <span className="flex shrink-0 items-center gap-2">
                {option.availability === "Scheduled" ? <StatusBadge tone="info">Starts later</StatusBadge> : null}
                {value === option.employeeId ? <Check className="size-4" /> : null}
              </span>
            </button>
          ))}
          {!loading && visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {options.length === 0 ? "No manager is available on this date" : "No manager matches your search"}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
