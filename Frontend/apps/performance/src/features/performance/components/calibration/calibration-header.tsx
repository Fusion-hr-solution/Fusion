"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { CalibrationFilter, CalibrationHeaderDto, CalibrationOptionDto, CalibrationSessionDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ds/components/ui/tooltip";
import { cn } from "@repo/ds/lib/utils";
import { AvatarStack } from "@repo/performance-ui";
import { ArrowLeft, ArrowRight, ChartColumn, Check, ChevronDown, ListView, NineBox, Search, X } from "@/lib/icons";
import { roundHref, withCycle } from "@/lib/performance-routes";
import type { CalibrationView } from "../../api/use-calibration";
import { dayLabel } from "../reviews/review-parts";

/** The session's title row: back to the round, state, facilitators and the one primary action. */
export function SessionTitle({ session, header, action, onFacilitators }: {
  session: CalibrationSessionDto;
  header: CalibrationHeaderDto;
  action: ReactNode;
  onFacilitators?: () => void;
}) {
  const finalized = session.state === "Finalized";
  const people = header.people + header.outstanding;
  return (
    <div className="mb-6">
      <Link href={withCycle(roundHref(session.reviewRoundId), session.cycleId)}
        className="mb-3 inline-flex items-center gap-1.5 rounded-detail text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden />{session.reviewRoundName}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="type-display text-foreground">Calibration</h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 type-meta font-semibold",
              finalized ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")}>
              {finalized ? <Check className="size-3.5" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}
              {finalized ? "Finalized" : "Open"}
            </span>
          </div>
          <p className="mt-1.5 type-meta text-muted-foreground">
            {[session.reviewRoundName, `${people} ${people === 1 ? "person" : "people"}`,
              finalized && session.finalizedAt ? `finalized ${dayLabel(session.finalizedAt.slice(0, 10))}` : `opened ${dayLabel(session.openedAt.slice(0, 10))}`].join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onFacilitators} disabled={!onFacilitators}
            className="flex items-center gap-2 rounded-control px-1 py-1 type-meta text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <AvatarStack names={session.facilitators.map((item) => item.displayName)} max={3} />
            Facilitators
          </button>
          {action}
        </div>
      </div>
    </div>
  );
}

/** Finalize, disabled with its reason while reviews are still with managers; the round once finalized. */
export function SessionAction({ session, header, onFinalize }: { session: CalibrationSessionDto; header: CalibrationHeaderDto; onFinalize: () => void }) {
  if (session.state === "Finalized") {
    return (
      <Button asChild>
        <Link href={withCycle(roundHref(session.reviewRoundId), session.cycleId)}>Open the round to release<ArrowRight className="size-4" aria-hidden /></Link>
      </Button>
    );
  }
  const waiting = header.outstanding > 0;
  const button = <Button onClick={onFinalize} disabled={waiting || header.people === 0}><Check className="size-4" aria-hidden />Finalize calibration</Button>;
  if (!waiting) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span tabIndex={0}>{button}</span></TooltipTrigger>
        <TooltipContent>{header.outstanding} {header.outstanding === 1 ? "review is" : "reviews are"} still with managers</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The five facts every view shares. */
export function SessionStats({ header }: { header: CalibrationHeaderDto }) {
  const discussed = header.people === 0 ? 0 : Math.round((header.discussed / header.people) * 100);
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-surface bg-card md:grid-cols-5" aria-label="Session">
      <Stat label="Discussed" value={header.discussed} suffix={`of ${header.people}`}>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-inlay" aria-hidden>
          <div className="h-full rounded-full bg-success" style={{ width: `${discussed}%` }} />
        </div>
      </Stat>
      <Stat label="Ratings changed" value={header.ratingChanged} />
      {header.potentialEnabled ? <Stat label="Potential changed" value={header.potentialChanged} /> : null}
      <Stat label="Flags" value={header.flags} suffix={header.flaggedNotDiscussed > 0 ? `${header.flaggedNotDiscussed} not discussed` : undefined} />
      <Stat label="With managers" value={header.outstanding} />
    </dl>
  );
}

function Stat({ label, value, suffix, children }: { label: string; value: number; suffix?: string; children?: ReactNode }) {
  return (
    <div className="border-border p-5 [&:not(:first-child)]:md:border-s">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex items-baseline gap-1.5">
        <span className="type-metric tabular-nums text-foreground">{value}</span>
        {suffix ? <span className="type-meta text-muted-foreground">{suffix}</span> : null}
      </dd>
      {children}
    </div>
  );
}

const TABS: { view: CalibrationView; label: string; icon: typeof ChartColumn }[] = [
  { view: "distribution", label: "Distribution", icon: ChartColumn },
  { view: "nine-box", label: "Nine-box", icon: NineBox },
  { view: "people", label: "People", icon: ListView },
];

/** View tabs and the filters they share. */
export function SessionToolbar({ header, view, filter, onView, onFilter }: {
  header: CalibrationHeaderDto;
  view: CalibrationView;
  filter: CalibrationFilter;
  onView: (view: CalibrationView) => void;
  onFilter: (filter: CalibrationFilter) => void;
}) {
  const tabs = TABS.filter((tab) => tab.view !== "nine-box" || header.potentialEnabled);
  return (
    <div className="my-6 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Views" className="inline-flex gap-1 rounded-control bg-card p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.view === view;
          return (
            <button key={tab.view} type="button" role="tab" aria-selected={selected} onClick={() => onView(tab.view)}
              className={cn("inline-flex items-center gap-2 rounded-nested px-3.5 py-2 type-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "bg-inlay text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" aria-hidden />{tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OptionFilter label="Unit" value={filter.unit ?? null} options={header.units} onChange={(unit) => onFilter({ ...filter, unit })} />
        <OptionFilter label="Manager" value={filter.manager ?? null} options={header.managers} onChange={(manager) => onFilter({ ...filter, manager })} />
        <ToggleFilter label="Flagged" on={Boolean(filter.flagged)} onChange={(flagged) => onFilter({ ...filter, flagged })} />
        <ToggleFilter label="Not discussed" on={Boolean(filter.notDiscussed)} onChange={(notDiscussed) => onFilter({ ...filter, notDiscussed })} />
        <SearchBox value={filter.q ?? ""} onChange={(q) => onFilter({ ...filter, q })} />
      </div>
    </div>
  );
}

function OptionFilter({ label, value, options, onChange }: {
  label: string; value: string | null; options: CalibrationOptionDto[]; onChange: (value: string | null) => void;
}) {
  const chosen = options.find((option) => option.id === value);
  if (chosen) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-control border border-primary bg-primary-tint ps-3 pe-1.5 type-label text-primary-ink">
        {label} <span className="text-foreground">{chosen.name}</span>
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(null)}
          className="rounded-detail p-0.5 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" disabled={options.length === 0}>{label}<ChevronDown className="size-3.5" aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={value ?? ""} onValueChange={(next) => onChange(next || null)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <span className="flex-1">{option.name}</span>
              <span className="ms-4 type-meta tabular-nums text-muted-foreground">{option.count}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToggleFilter({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Button variant="outline" size="sm" aria-pressed={on} onClick={() => onChange(!on)}
      className={cn("h-9", on && "border-primary bg-primary-tint text-primary-ink hover:bg-primary-tint")}>
      {on ? <Check className="size-3.5" aria-hidden /> : null}{label}
    </Button>
  );
}

/** Typing stays local; the address and the query follow after a short pause. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text), 300);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <label className="relative flex h-9 w-48 items-center">
      <Search className="pointer-events-none absolute inset-s-3 size-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">Find a person</span>
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Find a person"
        className="h-9 w-full rounded-control border border-input bg-transparent ps-9 pe-3 type-body text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </label>
  );
}
