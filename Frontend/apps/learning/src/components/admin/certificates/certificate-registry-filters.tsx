"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  Button,
  Input,
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
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <Field label={t("filters.search")}>
        <Input
          className="w-52"
          placeholder={t("filters.searchPlaceholder")}
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
        />
      </Field>
      <Field label={t("filters.formation")}>
        <Select
          value={filters.trainingId ?? ALL}
          onValueChange={(v) =>
            onChange({ trainingId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-48">
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
      <Field label={t("filters.grade")}>
        <Select
          value={filters.gradeId ?? ALL}
          onValueChange={(v) =>
            onChange({ gradeId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-40">
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
      <Field label={t("filters.status")}>
        <Select
          value={filters.status || ALL}
          onValueChange={(v) =>
            onChange({
              status:
                v === ALL ? "" : (v as CertificateRegistryFilters["status"]),
            })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
            <SelectItem value="Valid">{t("status.valid")}</SelectItem>
            <SelectItem value="Revoked">{t("status.revoked")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("filters.from")}>
        <Input
          type="date"
          className="w-40"
          value={filters.from ?? ""}
          onChange={(e) => onChange({ from: e.target.value || undefined })}
        />
      </Field>
      <Field label={t("filters.to")}>
        <Input
          type="date"
          className="w-40"
          value={filters.to ?? ""}
          onChange={(e) => onChange({ to: e.target.value || undefined })}
        />
      </Field>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        {t("filters.clear")}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
