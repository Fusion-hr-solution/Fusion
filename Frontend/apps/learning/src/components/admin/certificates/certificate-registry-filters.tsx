"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("adminCertificates");
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-4">
      <Field label={t("filters.search")} htmlFor="cert-filter-search">
        <Input
          id="cert-filter-search"
          className="w-52"
          placeholder={t("filters.searchPlaceholder")}
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
        />
      </Field>
      <Field label={t("filters.formation")} htmlFor="cert-filter-training">
        <Select
          value={filters.trainingId ?? ALL}
          onValueChange={(v) =>
            onChange({ trainingId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger id="cert-filter-training" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allFormations")}</SelectItem>
            {trainings.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("filters.grade")} htmlFor="cert-filter-grade">
        <Select value={filters.gradeId ?? ALL} onValueChange={(v) => onChange({ gradeId: v === ALL ? undefined : v })}>
          <SelectTrigger id="cert-filter-grade" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allGrades")}</SelectItem>
            {grades.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("filters.status")} htmlFor="cert-filter-status">
        <Select
          value={filters.status || ALL}
          onValueChange={(v) =>
            onChange({
              status:
                v === ALL ? "" : (v as CertificateRegistryFilters["status"]),
            })
          }
        >
          <SelectTrigger id="cert-filter-status" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
            <SelectItem value="Valid">{t("status.valid")}</SelectItem>
            <SelectItem value="Revoked">{t("status.revoked")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("filters.from")} htmlFor="cert-filter-from">
        <Input id="cert-filter-from" type="date" className="w-40" value={filters.from ?? ""} onChange={(e) => onChange({ from: e.target.value || undefined })} />
      </Field>
      <Field label={t("filters.to")} htmlFor="cert-filter-to">
        <Input id="cert-filter-to" type="date" className="w-40" value={filters.to ?? ""} onChange={(e) => onChange({ to: e.target.value || undefined })} />
      </Field>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        {t("filters.clear")}
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
