"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import type { CertificateRegistryFilters } from "@/types";

interface FilterOption {
  id: string;
  label: string;
}

interface CertificateRegistryFiltersBarProps {
  filters: CertificateRegistryFilters;
  onChange: (patch: Partial<CertificateRegistryFilters>) => void;
  onClear: () => void;
  trainings: FilterOption[];
  grades: FilterOption[];
}

const ALL = "all";

export function CertificateRegistryFiltersBar({
  filters,
  onChange,
  onClear,
  trainings,
  grades,
}: CertificateRegistryFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-4">
      <Field label="Search" htmlFor="cert-filter-search">
        <Input
          id="cert-filter-search"
          className="w-52"
          placeholder="Number or employee"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
        />
      </Field>
      <Field label="Formation" htmlFor="cert-filter-training">
        <Select
          value={filters.trainingId ?? ALL}
          onValueChange={(v) => onChange({ trainingId: v === ALL ? undefined : v })}
        >
          <SelectTrigger id="cert-filter-training" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All formations</SelectItem>
            {trainings.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Grade" htmlFor="cert-filter-grade">
        <Select value={filters.gradeId ?? ALL} onValueChange={(v) => onChange({ gradeId: v === ALL ? undefined : v })}>
          <SelectTrigger id="cert-filter-grade" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All grades</SelectItem>
            {grades.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Status" htmlFor="cert-filter-status">
        <Select
          value={filters.status || ALL}
          onValueChange={(v) => onChange({ status: v === ALL ? "" : (v as CertificateRegistryFilters["status"]) })}
        >
          <SelectTrigger id="cert-filter-status" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="Valid">Valid</SelectItem>
            <SelectItem value="Revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="From" htmlFor="cert-filter-from">
        <Input id="cert-filter-from" type="date" className="w-40" value={filters.from ?? ""} onChange={(e) => onChange({ from: e.target.value || undefined })} />
      </Field>
      <Field label="To" htmlFor="cert-filter-to">
        <Input id="cert-filter-to" type="date" className="w-40" value={filters.to ?? ""} onChange={(e) => onChange({ to: e.target.value || undefined })} />
      </Field>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        Clear
      </Button>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
