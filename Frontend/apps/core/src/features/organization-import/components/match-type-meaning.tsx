"use client";

import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@repo/ds";
import type { OrganizationImportMatch } from "@repo/api";
import { deriveTypeRows } from "../model/match-mapping";
import { TYPE_GRID, MappingHead, MappingSection, MappingStatusPill, useMatchEdit } from "./match-mapping-parts";

/**
 * What each distinct type label in the file means in Fusion. One decision per label covers
 * every row carrying it. An unresolved label is emphasized in place; the order never shifts.
 */
export function MatchTypeMeaning({ match, locked = false }: { match: OrganizationImportMatch; locked?: boolean }) {
  const t = useTranslations("orgImport.match.types");
  const rows = deriveTypeRows(match);
  const { edit, busy, pendingValue } = useMatchEdit();
  if (rows.length === 0) return null;

  return (
    <MappingSection
      id="match-types-title"
      title={t("title")}
      description={t("description")}
    >
      <MappingHead grid={TYPE_GRID} labels={[t("source"), t("occurrences"), t("fusion"), t("status")]} />
      <div role="rowgroup" className="divide-y divide-border">
        {rows.map((row) => {
          const key = `type:${row.sourceValue}`;
          const pending = pendingValue(key);
          const attention = row.status === "needs-review" && pending === undefined;
          return (
            <div
              key={row.sourceValue}
              role="row"
              className={cn(
                TYPE_GRID,
                "px-4 py-2",
                attention && "relative z-10 rounded-control bg-primary/[0.07] ring-1 ring-primary/70 ring-inset"
              )}
            >
              <span role="rowheader" className="flex min-w-0 items-center gap-2">
                {attention ? (
                  <CircleAlert aria-hidden className="size-4.5 shrink-0 fill-primary stroke-card" strokeWidth={2.25} />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate type-label font-semibold text-foreground" title={row.sourceValue}>
                    {row.sourceValue}
                  </span>
                  <span aria-hidden className="block type-meta text-muted-foreground tabular-nums @2xl:hidden">
                    {t("count", { count: row.occurrences })}
                  </span>
                </span>
              </span>
              <span role="cell" className="hidden type-meta text-foreground tabular-nums @2xl:block">
                {row.occurrences}
              </span>
              <span role="cell">
                <Select
                  value={pending ?? row.typeId ?? ""}
                  disabled={busy || locked}
                  onValueChange={(typeId) =>
                    void edit(key, typeId, { typeMappings: { [row.sourceValue]: typeId } })
                  }
                >
                  <SelectTrigger
                    aria-label={t("typeFor", { label: row.sourceValue })}
                    className={cn("w-full", attention && "border-primary/70")}
                  >
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {match.typeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
              <span role="cell">
                <MappingStatusPill status={row.status} pending={pending !== undefined} />
              </span>
            </div>
          );
        })}
      </div>
    </MappingSection>
  );
}
