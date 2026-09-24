"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@repo/ds";
import type { OrganizationImportMatch, OrganizationSourceTable } from "@repo/api";
import { buildMatchPreview, type PreviewType } from "../model/match-preview";

const ROW_LIMITS = [5, 10, 25] as const;

/** The file's first rows read through the current mapping, so the administrator sees what the matches mean. */
export function MatchFilePreview({
  table,
  match,
}: {
  table: OrganizationSourceTable;
  match: OrganizationImportMatch;
}) {
  const [limit, setLimit] = useState<number>(5);
  const rows = useMemo(() => buildMatchPreview(table, match, limit), [table, match, limit]);
  const limits = ROW_LIMITS.filter((option, index) => index === 0 || table.rows.length > ROW_LIMITS[index - 1]!);

  return (
    <section aria-labelledby="match-preview-title" className="rounded-surface border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <FileSpreadsheet className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 id="match-preview-title" className="type-panel-title font-semibold text-foreground">
              File preview
            </h2>
            <p className="type-meta text-muted-foreground">A preview of your data with applied mappings.</p>
          </div>
        </div>
        {limits.length > 1 ? (
          <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
            <SelectTrigger aria-label="Rows to preview" className="shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {limits.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  First {option} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </header>

      <div className="mt-4 overflow-x-auto rounded-object border border-border">
        <table className="w-full min-w-[24rem] border-collapse text-left">
          <thead className="bg-muted/50">
            <tr className="type-eyebrow text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-semibold">Business code</th>
              <th scope="col" className="px-3 py-2 font-semibold">Name</th>
              <th scope="col" className="px-3 py-2 font-semibold">Parent code</th>
              <th scope="col" className="px-3 py-2 font-semibold">Type</th>
            </tr>
          </thead>
          <tbody className="type-meta">
            {rows.map((row) => (
              <tr key={row.rowNumber} className="border-t border-border">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap text-foreground">{row.businessCode ?? <Missing />}</td>
                <td className="px-3 py-1.5 text-foreground">{row.name ?? <Missing />}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-foreground">{row.parentCode ?? <Missing />}</td>
                <td className="px-3 py-1.5">
                  <TypeCell type={row.type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Missing() {
  return (
    <span className="text-muted-foreground" aria-label="None">
      —
    </span>
  );
}

function TypeCell({ type }: { type: PreviewType }) {
  if (type.kind === "empty") return <Missing />;
  if (type.kind === "matched") return <span className="text-foreground">{type.label}</span>;
  return (
    <span
      title="Not matched yet"
      className={cn("inline-flex items-center gap-1.5 text-primary-foreground dark:text-primary")}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {type.sourceValue}
      <span className="sr-only"> (not matched yet)</span>
    </span>
  );
}
