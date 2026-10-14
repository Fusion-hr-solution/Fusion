"use client";

import type { CalibrationDistributionDto } from "@repo/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ds/components/ui/tooltip";
import { cn } from "@repo/ds/lib/utils";
import { distributionRows } from "./calibration-model";

/**
 * Original against current ratings, one pair of columns per scale level on one shared axis. The original is
 * the recessive outlined column and the current one is filled in the accent, so the pair reads by shape as
 * well as colour. Only current counts are labelled; the rest is in the hover layer and the table below.
 */
export function CalibrationDistribution({ distribution }: { distribution: CalibrationDistributionDto[] }) {
  const rows = distributionRows(distribution);
  return (
    <figure aria-labelledby="calibration-distribution-title" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="calibration-distribution-title" className="type-section-title text-foreground">Rating distribution</h2>
        <div className="flex items-center gap-4 type-meta text-muted-foreground" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-detail border border-muted-foreground/70" />Manager rating</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-detail bg-primary" />After calibration</span>
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="mt-4 grid items-end gap-x-3 sm:gap-x-6" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} aria-hidden>
          {rows.map((row) => (
            <Tooltip key={row.value}>
              <TooltipTrigger asChild>
                <div className="flex h-32 items-end justify-center gap-0.5 border-b border-border">
                  <Column share={row.originalShare} className="border border-b-0 border-muted-foreground/70" />
                  <Column share={row.currentShare} className="bg-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="font-medium">{row.label}</span>
                <span className="ml-2 tabular-nums">{row.original} → {row.current}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      <div className="mt-2 grid gap-x-3 sm:gap-x-6" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} aria-hidden>
        {rows.map((row) => (
          <div key={row.value} className="min-w-0 text-center">
            <div className="truncate type-label text-foreground" title={row.label}>{row.label}</div>
            <div className="type-meta tabular-nums text-muted-foreground">
              <span className="text-foreground">{row.current}</span>
              {row.delta !== 0 ? <span className="ml-1">({row.delta > 0 ? `+${row.delta}` : `−${Math.abs(row.delta)}`})</span> : null}
            </div>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Subjects per rating level, manager rating and after calibration</caption>
        <thead><tr><th scope="col">Level</th><th scope="col">Manager rating</th><th scope="col">After calibration</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.value}><th scope="row">{row.label}</th><td>{row.original}</td><td>{row.current}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function Column({ share, className }: { share: number; className: string }) {
  // A zero column keeps a hairline so the level still reads as present and empty.
  return (
    <span
      className={cn("block w-full max-w-7 rounded-t-detail transition-[height] duration-200", share === 0 && "h-px border-0 bg-border", share > 0 && className)}
      style={share > 0 ? { height: `${Math.max(share * 100, 4)}%` } : undefined}
    />
  );
}
