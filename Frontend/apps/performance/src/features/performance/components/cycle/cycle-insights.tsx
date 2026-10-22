"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type {
  InsightsDto,
  InsightsManagerDto,
  InsightsMetric,
  InsightsPeopleQuery,
  InsightsPersonDto,
  InsightsRowDto,
  StatusMixDto,
} from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import { PersonInitials } from "@repo/performance-ui";
import { ChevronDown, ChevronRight } from "@/lib/icons";
import { useInsights, useInsightsPeople } from "../../api/use-performance";
import { ContentUnavailable } from "../content-unavailable";
import { appHref, day, plural } from "../overview/overview-model";

/**
 * Cycle › Insights (boards 26–28): how the cycle is going across the organization, as counts, shares and
 * distributions only (no averages, no export). Sections appear as the phase produces their facts; every figure
 * opens the people behind it in a drawer, paged on the server.
 */

type Drill = Omit<InsightsPeopleQuery, "page" | "pageSize"> & { context: string };

const METRIC_TITLE: Record<InsightsMetric, string> = {
  people: "People",
  "plans-approved": "Plans approved",
  "plans-not-approved": "Plans not approved",
  updated: "Updated in the last 30 days",
  "not-updated": "No update in 30 days",
  "at-risk-or-off-track": "Objectives at risk or off track",
  reviews: "Reviews",
  "on-time": "Manager reviews on time",
  late: "Manager reviews late",
  released: "Results released",
  acknowledged: "Acknowledged",
  "not-acknowledged": "Not acknowledged",
  level: "Rated",
  raised: "Raised in calibration",
  lowered: "Lowered in calibration",
};

const share = (part: number | null, whole: number | null) => (part != null && whole ? Math.round((part / whole) * 100) : null);

export function CycleInsights({ cycleId, unitId, onUnit }: { cycleId: string; unitId: string | null; onUnit: (unitId: string | null) => void }) {
  const insights = useInsights(cycleId, unitId);
  const [drill, setDrill] = useState<Drill | null>(null);

  if (insights.error) return <ContentUnavailable error={insights.error} onRetry={insights.refetch} subject="Insights" />;
  if (!insights.data) return <InsightsSkeleton />;
  const data = insights.data;
  const open = (metric: InsightsMetric, context: string, extra?: Partial<Drill>) =>
    setDrill({ metric, unitId: unitId, context, ...extra });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UnitFilter data={data} onUnit={onUnit} />
        <span className="type-meta text-muted-foreground">{data.final ? "Final" : `As of ${day(data.asOf)}`}</span>
      </div>
      <FactStrip data={data} open={open} />
      <ByUnit data={data} open={open} />
      {data.showsExecution && data.direction.length > 0 ? <CompanyDirection data={data} /> : null}
      {data.showsReviews && data.byManager.length > 0 ? <ByManager data={data} open={open} /> : null}
      <PeopleDrawer cycleId={cycleId} cycleName={data.cycleName} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function UnitFilter({ data, onUnit }: { data: InsightsDto; onUnit: (unitId: string | null) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn(data.unitId && "border-primary bg-primary-tint text-primary-ink")}>
          <span className="text-muted-foreground">Unit</span> {data.scopeName}
          <ChevronDown className="size-4" data-icon="inline-end" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={data.unitId ?? ""} onValueChange={(value) => onUnit(value || null)}>
          <DropdownMenuRadioItem value="">The whole organization</DropdownMenuRadioItem>
          {data.units.map((unit) => (
            <DropdownMenuRadioItem key={unit.unitId} value={unit.unitId} style={{ paddingLeft: `${0.5 + unit.depth * 0.75}rem` }}>
              {unit.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A figure that opens the people behind it. */
function Figure({ onOpen, label, children, className }: { onOpen: () => void; label: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(
        "rounded-detail text-left tabular-nums hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}

type Open = (metric: InsightsMetric, context: string, extra?: Partial<Drill>) => void;

function Tile({ label, value, of, detail, onOpen }: { label: string; value: ReactNode; of?: ReactNode; detail?: ReactNode; onOpen?: () => void }) {
  const body = (
    <>
      <span className="font-display text-4xl font-semibold leading-none text-foreground">{value}</span>
      {of ? <span className="ml-1.5 type-body-secondary text-muted-foreground">{of}</span> : null}
    </>
  );
  return (
    <div className="min-w-0 px-5 py-5">
      <p className="type-meta text-muted-foreground">{label}</p>
      <div className="mt-2">{onOpen ? <Figure onOpen={onOpen} label={label}>{body}</Figure> : body}</div>
      {detail ? <p className="mt-2 truncate type-meta text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function FactStrip({ data, open }: { data: InsightsDto; open: Open }) {
  const t = data.total;
  const scope = data.scopeName;
  let tiles: ReactNode[];
  if (data.showsReviews) {
    const changed = (t.raised ?? 0) + (t.lowered ?? 0);
    tiles = [
      <Tile key="released" label="Results released" value={t.released ?? 0} of={`of ${t.reviews ?? 0}`}
        detail={data.releasedAt ? day(data.releasedAt) : "Not released yet"} onOpen={() => open("released", scope)} />,
      <Tile key="ack" label="Acknowledged" value={t.acknowledged ?? 0} of={`of ${t.released ?? 0}`}
        detail={(t.released ?? 0) > (t.acknowledged ?? 0) ? `${(t.released ?? 0) - (t.acknowledged ?? 0)} not yet` : null}
        onOpen={() => open("not-acknowledged", scope)} />,
      <Tile key="ontime" label="Manager reviews on time" value={t.onTime ?? 0} of={`of ${t.reviews ?? 0}`}
        detail={(t.late ?? 0) > 0 ? `${t.late} after ${data.managerDue ? day(data.managerDue) : "the due date"}` : null}
        onOpen={() => open("late", scope)} />,
      <Tile key="calibration" label="Changed in calibration" value={changed} of={changed === 1 ? "rating" : "ratings"}
        detail={`${t.raised ?? 0} raised · ${t.lowered ?? 0} lowered`} onOpen={() => open("lowered", scope)} />,
    ];
  } else if (data.showsExecution) {
    const status = t.status;
    const flagged = status ? status.atRisk + status.offTrack : 0;
    tiles = [
      <Tile key="plans" label="Plans approved" value={t.plansApproved} of={`of ${t.people}`}
        detail={data.neverApproved > 0 ? `${data.neverApproved} never approved` : null} onOpen={() => open("plans-not-approved", scope)} />,
      <Tile key="updated" label="Updated in the last 30 days" value={t.updatedIn30Days ?? 0} of={`of ${t.approvedPlans ?? 0}`}
        detail={data.withoutRecentUpdate > 0 ? `${plural(data.withoutRecentUpdate, "person", "people")} without an update` : null}
        onOpen={() => open("not-updated", scope)} />,
      <Tile key="risk" label="At risk or off track" value={flagged} of={`of ${plural(t.objectives ?? 0, "objective")}`}
        detail={status ? `${status.atRisk} at risk · ${status.offTrack} off track` : null} onOpen={() => open("at-risk-or-off-track", scope)} />,
      <Tile key="aligned" label="Aligned to company direction" value={`${share(t.aligned, t.objectives) ?? 0}%`} of={`${t.aligned ?? 0} of ${t.objectives ?? 0}`} />,
    ];
  } else {
    tiles = [
      <Tile key="people" label="Participants" value={t.people} onOpen={() => open("people", scope)} />,
      <Tile key="plans" label="Plans approved" value={t.plansApproved} of={`of ${t.people}`} onOpen={() => open("plans-not-approved", scope)} />,
    ];
  }
  return (
    <div className="grid divide-y divide-border overflow-hidden rounded-surface bg-card ring-1 ring-inset ring-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      {tiles}
    </div>
  );
}

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <span className="relative block h-2 w-28 overflow-hidden rounded-full bg-inlay ring-1 ring-inset ring-border">
      <span className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: `${pct}%` }} />
    </span>
  );
}

function StatusBar({ status }: { status: StatusMixDto }) {
  const segments = [
    { count: status.onTrack, className: "bg-success" },
    { count: status.atRisk, className: "bg-warning" },
    { count: status.offTrack, className: "bg-destructive" },
    { count: status.noStatus, className: "bg-inlay ring-1 ring-inset ring-border" },
  ].filter((s) => s.count > 0);
  return (
    <span role="img" aria-label={`${status.onTrack} on track, ${status.atRisk} at risk, ${status.offTrack} off track, ${status.noStatus} no status yet`} className="flex h-2 w-36 gap-[2px]">
      {segments.map((s, i) => (
        <span key={i} className={cn("min-w-1 rounded-full", s.className)} style={{ flexGrow: s.count, flexBasis: 0 }} />
      ))}
    </span>
  );
}

const TH = "h-10 px-4 text-left text-xs font-medium whitespace-nowrap text-muted-foreground";
const TD = "h-12 px-4 align-middle text-sm";

function Frame({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="type-section-title text-foreground">{title}</h2>
        {aside}
      </div>
      <div className="overflow-x-auto rounded-surface bg-card ring-1 ring-inset ring-border">{children}</div>
    </section>
  );
}

function ByUnit({ data, open }: { data: InsightsDto; open: Open }) {
  const levels = data.total.levels ?? [];
  const reviews = data.showsReviews;
  const execution = data.showsExecution && !reviews;
  const rows = [...data.byUnit.map((row) => ({ row, total: false })), { row: data.total, total: true }];
  const drillFor = (row: InsightsRowDto, total: boolean) => (metric: InsightsMetric, extra?: Partial<Drill>) =>
    open(metric, row.name, total ? extra : { unitId: row.unitId, ...extra });

  return (
    <Frame
      title="By unit"
      aside={
        reviews ? (
          <span className="type-meta text-muted-foreground">Final ratings after calibration · people at each level</span>
        ) : execution ? (
          <ul className="flex flex-wrap gap-4 type-meta text-muted-foreground">
            {[["bg-success", "On track"], ["bg-warning", "At risk"], ["bg-destructive", "Off track"], ["bg-inlay ring-1 ring-inset ring-border", "No status yet"]].map(([dot, label]) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-detail", dot)} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        ) : null
      }
    >
      <table className="w-full min-w-[56rem]">
        <thead className="bg-inlay">
          <tr className="border-b border-border">
            <th scope="col" className={TH}>Unit</th>
            <th scope="col" className={cn(TH, "text-right")}>People</th>
            {reviews ? (
              <>
                <th scope="col" className={TH}>Manager reviews on time</th>
                <th scope="col" className={TH}>Acknowledged</th>
                {levels.map((l) => (
                  <th key={l.value} scope="col" className={cn(TH, "text-center")} title={l.label}>{l.value}</th>
                ))}
                <th scope="col" className={cn(TH, "text-right")}>Calibration</th>
              </>
            ) : (
              <>
                <th scope="col" className={TH}>Plans approved</th>
                {execution ? (
                  <>
                    <th scope="col" className={TH}>Updated in the last 30 days</th>
                    <th scope="col" className={TH}>Objective status, as owners set it</th>
                    <th scope="col" className={cn(TH, "text-right")}>Aligned</th>
                  </>
                ) : null}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, total }) => {
            const drill = drillFor(row, total);
            return (
              <tr key={row.unitId ?? (total ? "total" : row.name)} className={cn("border-b border-border last:border-0", total && "bg-inlay font-semibold")}>
                <th scope="row" className={cn(TD, "text-left font-semibold text-foreground")}>{total ? (data.unitId ? `All of ${data.scopeName}` : "All units") : row.name}</th>
                <td className={cn(TD, "text-right tabular-nums")}>
                  <Figure onOpen={() => drill("people")} label={`${row.people} people in ${row.name}`}>{row.people}</Figure>
                </td>
                {reviews ? (
                  <>
                    <td className={TD}>
                      <Figure onOpen={() => drill("late")} label={`Manager reviews late in ${row.name}`}>
                        {row.onTime ?? 0} of {row.reviews ?? 0}
                        {(row.late ?? 0) > 0 ? <span className="type-meta text-muted-foreground"> · {row.late} late</span> : null}
                      </Figure>
                    </td>
                    <td className={TD}>
                      {(row.released ?? 0) === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="flex items-center gap-3">
                          {total ? null : <Bar value={row.acknowledged ?? 0} total={row.released ?? 0} />}
                          <Figure onOpen={() => drill("not-acknowledged")} label={`Not acknowledged in ${row.name}`}>
                            {row.acknowledged ?? 0} of {row.released ?? 0}
                          </Figure>
                        </span>
                      )}
                    </td>
                    {levels.map((l) => {
                      const count = row.levels?.find((x) => x.value === l.value)?.count ?? 0;
                      return (
                        <td key={l.value} className={cn(TD, "text-center")}>
                          {count === 0 ? (
                            <span className="text-muted-foreground">0</span>
                          ) : (
                            <Figure onOpen={() => drill("level", { level: l.value })} label={`Rated ${l.value} in ${row.name}`}
                              className={cn("inline-grid min-w-9 place-items-center px-2 py-1", total ? "" : "bg-inlay ring-1 ring-inset ring-border")}>
                              {count}
                            </Figure>
                          )}
                        </td>
                      );
                    })}
                    <td className={cn(TD, "text-right whitespace-nowrap tabular-nums")}>
                      {(row.raised ?? 0) + (row.lowered ?? 0) === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-flex gap-2">
                          {row.raised ? <Figure onOpen={() => drill("raised")} label={`Raised in ${row.name}`} className="text-success">↑{row.raised}</Figure> : null}
                          {row.lowered ? <Figure onOpen={() => drill("lowered")} label={`Lowered in ${row.name}`} className="text-warning">↓{row.lowered}</Figure> : null}
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td className={TD}>
                      <span className="flex items-center gap-3">
                        {total ? null : <Bar value={row.plansApproved} total={row.people} />}
                        <Figure onOpen={() => drill("plans-not-approved")} label={`Plans not approved in ${row.name}`}>
                          {row.plansApproved} of {row.people}
                        </Figure>
                      </span>
                    </td>
                    {execution ? (
                      <>
                        <td className={TD}>
                          <Figure onOpen={() => drill("not-updated")} label={`Not updated in ${row.name}`}>
                            {row.updatedIn30Days ?? 0} of {row.approvedPlans ?? 0}
                            <span className="type-meta text-muted-foreground"> · {share(row.updatedIn30Days, row.approvedPlans) ?? 0}%</span>
                          </Figure>
                        </td>
                        <td className={TD}>
                          <span className="flex items-center gap-3">
                            {row.status && !total ? <StatusBar status={row.status} /> : null}
                            <Figure onOpen={() => drill("at-risk-or-off-track")} label={`At risk or off track in ${row.name}`}>
                              {row.status ? row.status.atRisk + row.status.offTrack : 0}
                              <span className="type-meta text-muted-foreground"> at risk or off{total ? ` · of ${row.objectives ?? 0}` : ""}</span>
                            </Figure>
                          </span>
                        </td>
                        <td className={cn(TD, "text-right tabular-nums")}>{share(row.aligned, row.objectives) ?? 0}%</td>
                      </>
                    ) : null}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Frame>
  );
}

function CompanyDirection({ data }: { data: InsightsDto }) {
  return (
    <Frame title="Company direction">
      <table className="w-full min-w-[48rem]">
        <thead className="bg-inlay">
          <tr className="border-b border-border">
            <th scope="col" className={TH}>Company objective</th>
            <th scope="col" className={TH}>Owner</th>
            <th scope="col" className={cn(TH, "text-right")}>Aligned objectives</th>
            <th scope="col" className={cn(TH, "text-right")}>Units contributing</th>
            <th scope="col" className={TH}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {data.direction.map((o) => (
            <tr key={o.objectiveId} className="border-b border-border">
              <th scope="row" className={cn(TD, "text-left font-semibold text-foreground")}>{o.title}</th>
              <td className={TD}>{o.owner ?? "—"}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{o.alignedObjectives}</td>
              <td className={cn(TD, "text-right tabular-nums")}>{o.unitsContributing} of {o.units}</td>
              <td className={TD}>
                <span className="flex items-center gap-3">
                  <span className="relative block h-1.5 w-28 overflow-hidden rounded-full bg-inlay">
                    {o.hasProgress ? <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, o.progress)}%` }} /> : null}
                  </span>
                  <span className="tabular-nums">{o.hasProgress ? `${Math.round(o.progress)}%` : "—"}</span>
                </span>
              </td>
            </tr>
          ))}
          <tr className="bg-inlay">
            <th scope="row" className={cn(TD, "text-left font-semibold text-foreground")} colSpan={2}>Not aligned to any company objective</th>
            <td className={cn(TD, "text-right font-semibold tabular-nums")}>{data.notAligned}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </Frame>
  );
}

const MANAGERS_SHOWN = 5;

function ByManager({ data, open }: { data: InsightsDto; open: Open }) {
  const [all, setAll] = useState(false);
  const managers = all ? data.byManager : data.byManager.slice(0, MANAGERS_SHOWN);
  const drill = (m: InsightsManagerDto, metric: InsightsMetric) => open(metric, m.name, { managerId: m.employeeId });
  return (
    <Frame title="By manager">
      <table className="w-full min-w-[44rem]">
        <thead className="bg-inlay">
          <tr className="border-b border-border">
            <th scope="col" className={TH}>Manager</th>
            <th scope="col" className={cn(TH, "text-right")}>People</th>
            <th scope="col" className={TH}>Late manager reviews</th>
            <th scope="col" className={TH}>Acknowledged</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => (
            <tr key={m.employeeId} className="border-b border-border">
              <th scope="row" className={cn(TD, "text-left")}>
                <span className="flex items-center gap-3">
                  <PersonInitials name={m.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{m.name}</span>
                    {m.unitName ? <span className="block truncate type-meta font-normal text-muted-foreground">{m.unitName}</span> : null}
                  </span>
                </span>
              </th>
              <td className={cn(TD, "text-right tabular-nums")}>{m.people}</td>
              <td className={TD}>
                {m.late > 0 ? (
                  <Figure onOpen={() => drill(m, "late")} label={`Late reviews by ${m.name}`} className="text-warning">
                    {m.late} after {data.managerDue ? day(data.managerDue) : "the due date"}
                  </Figure>
                ) : (
                  <span className="text-muted-foreground">All on time</span>
                )}
              </td>
              <td className={TD}>
                <Figure onOpen={() => drill(m, "not-acknowledged")} label={`Not acknowledged for ${m.name}`}>
                  {m.acknowledged} of {m.released}
                </Figure>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.byManager.length > MANAGERS_SHOWN ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 type-meta text-muted-foreground">
          <span>
            {managers.length} of {data.byManager.length} managers, most late first
          </span>
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${data.byManager.length}`}
          </Button>
        </div>
      ) : null}
    </Frame>
  );
}

const PAGE_SIZE = 25;

/** What a person's line says beside their name, for the figure that listed them. */
export function personFacts(metric: InsightsMetric, p: InsightsPersonDto): string[] {
  switch (metric) {
    case "late":
    case "on-time":
    case "reviews":
      return [p.managerSubmittedAt ? `Submitted ${day(p.managerSubmittedAt)}` : "Not submitted", p.managerDue ? `Due ${day(p.managerDue)}` : null].filter(Boolean) as string[];
    case "released":
    case "acknowledged":
    case "not-acknowledged":
      return [p.releasedAt ? `Released ${day(p.releasedAt)}` : null, p.acknowledgedAt ? `Acknowledged ${day(p.acknowledgedAt)}` : null].filter(Boolean) as string[];
    case "level":
    case "raised":
    case "lowered":
      return p.level == null ? [] : [p.managerLevel != null && p.managerLevel !== p.level ? `${p.managerLevel} → ${p.level}` : `Rated ${p.level}`];
    default:
      return [p.planState ? (p.planState === "NotStarted" ? "No plan" : `Plan ${p.planState === "ReturnedForChanges" ? "returned" : p.planState.toLowerCase()}`) : null,
        p.lastUpdateAt ? `Updated ${day(p.lastUpdateAt)}` : null].filter(Boolean) as string[];
  }
}

function PeopleDrawer({ cycleId, cycleName, drill, onClose }: { cycleId: string; cycleName: string; drill: Drill | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const query = drill ? { metric: drill.metric, unitId: drill.unitId, managerId: drill.managerId, level: drill.level, page, pageSize: PAGE_SIZE } : null;
  const people = useInsightsPeople(cycleId, query);
  const data = people.data;
  const title = drill ? (drill.metric === "level" ? `Rated ${drill.level}` : METRIC_TITLE[drill.metric]) : "";
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Sheet open={drill !== null} onOpenChange={(next) => { if (!next) { setPage(1); onClose(); } }}>
      <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[32rem]">
        <div className="border-b border-border px-6 pt-6 pb-5">
          <SheetDescription className="type-meta text-muted-foreground">
            {drill?.context} · {cycleName}
          </SheetDescription>
          <SheetTitle className="mt-1 type-page-title text-foreground">
            {title}
            {data ? <span className="text-muted-foreground"> · {data.total}</span> : null}
          </SheetTitle>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {people.error ? (
            <p role="alert" className="px-3 py-4 text-sm text-destructive">{people.error.message}</p>
          ) : !data ? (
            <div className="space-y-2 p-3" role="status" aria-label="Loading people">
              {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : data.items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">No one</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.items.map((p) => {
                const facts = personFacts(data.metric, p);
                const body = (
                  <>
                    <PersonInitials name={p.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-label text-foreground">{p.name}</span>
                      <span className="block truncate type-meta text-muted-foreground">
                        {[p.jobTitle, p.unitName, p.managerName ? `Manager ${p.managerName}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right type-meta text-muted-foreground">
                      {facts.map((f) => <span key={f} className="block">{f}</span>)}
                    </span>
                  </>
                );
                return (
                  <li key={p.employeeId}>
                    {p.href ? (
                      <Link href={appHref(p.href)} className="group flex items-center gap-3 rounded-inset px-3 py-3 hover:bg-inlay">
                        {body}
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {data && pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-6 py-3 type-meta text-muted-foreground">
            <span>
              Page {page} of {pages}
            </span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </span>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading Insights">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-32 rounded-surface" />
      <Skeleton className="h-80 rounded-surface" />
    </div>
  );
}
