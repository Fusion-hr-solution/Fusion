"use client";

import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  cn,
} from "@repo/ds";
import type { OrganizationImportMatch, OrganizationSourceTable } from "@repo/api";
import {
  IGNORE,
  MAPPABLE_FIELDS,
  columnTargetChange,
  deriveColumnRows,
  type MappableField,
  fieldSources,
  missingRequiredFields,
  type ColumnMappingRow,
  type ColumnTarget,
} from "../model/match-mapping";
import { COLUMN_GRID, MappingHead, MappingSection, MappingStatusPill, useMatchEdit } from "./match-mapping-parts";

/** What each source column means in Fusion. Resolved rows stay quiet and correctable. */
export function MatchColumnMapping({
  table,
  match,
  locked = false,
}: {
  table: OrganizationSourceTable;
  match: OrganizationImportMatch;
  locked?: boolean;
}) {
  const t = useTranslations("orgImport.match.columns");
  const fields = useTranslations("orgImport.match.fields");
  const rows = deriveColumnRows(table, match);
  const missing = missingRequiredFields(match);
  const sources = fieldSources(table, match);
  const { edit, busy, pendingValue } = useMatchEdit();

  async function choose(row: ColumnMappingRow, target: ColumnTarget) {
    const change = columnTargetChange(match, row.columnIndex, target);
    if (!change) return;
    const displaced = target === IGNORE ? undefined : sources.get(target);
    const saved = await edit(`column:${row.columnIndex}`, target, change);
    if (saved && displaced && displaced.columnIndex !== row.columnIndex)
      toast(t("now", { field: fields(target as MappableField), column: row.label }), {
        description: t("ignoredNow", { column: displaced.label }),
      });
  }

  return (
    <MappingSection id="match-columns-title" title={t("title")}>
      <MappingHead grid={COLUMN_GRID} labels={[t("source"), t("samples"), t("field"), t("status")]} />
      <div role="rowgroup" className="divide-y divide-border">
        {rows.map((row) => {
          const key = `column:${row.columnIndex}`;
          const pending = pendingValue(key);
          const samples = row.samples.length ? row.samples.join(", ") : "—";
          return (
            <div key={row.columnIndex} role="row" className={cn(COLUMN_GRID, "px-4 py-2")}>
              <span role="rowheader" className="min-w-0">
                <span className="block truncate type-label font-semibold text-foreground" title={row.label}>
                  {row.label}
                </span>
                <span aria-hidden className="block truncate type-meta text-muted-foreground @2xl:hidden" title={samples}>
                  {samples}
                </span>
              </span>
              <span role="cell" className="hidden truncate type-meta text-muted-foreground @2xl:block" title={samples}>
                {samples}
              </span>
              <span role="cell">
                {typeof row.target === "object" ? (
                  <span className="type-meta text-foreground">{t("level", { level: row.target.level })}</span>
                ) : (
                  <Select
                    value={pending ?? row.target}
                    disabled={busy || locked}
                    onValueChange={(value) => void choose(row, value as ColumnTarget)}
                  >
                    <SelectTrigger
                      aria-label={t("fieldFor", { column: row.label })}
                      className={cn("w-full", row.status === "needs-review" && "border-primary/70")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAPPABLE_FIELDS.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {fields(field.key)}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={IGNORE}>{t("ignore")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </span>
              <span role="cell">
                <MappingStatusPill status={row.status} pending={pending !== undefined} />
              </span>
            </div>
          );
        })}
        {missing.map((field) => (
          <div
            key={field}
            role="row"
            className="flex items-center gap-2 bg-primary/[0.06] px-4 py-2.5 type-meta text-primary-foreground dark:text-primary"
          >
            <CircleAlert aria-hidden className="size-4 shrink-0 fill-primary stroke-card" strokeWidth={2.25} />
            <span role="cell">
              {t.rich("missing", { field: fields(field), b: (chunks) => <span className="font-semibold">{chunks}</span> })}
            </span>
          </div>
        ))}
      </div>
    </MappingSection>
  );
}
