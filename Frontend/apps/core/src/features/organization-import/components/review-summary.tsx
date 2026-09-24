"use client";

import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle2,
  FileText,
  LayoutGrid,
  Layers,
  Network,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ds";
import type { OrganizationImportReview, OrganizationImportSourceDto } from "@repo/api";
import { formatHumanDate } from "../model/format";
import { ReviewTypeIcon } from "./review-type-icon";

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Where the proposal stands: ready, ready with things to notice, or blocked, with the facts that decide it. */
export function ReviewStatusBanner({ review }: { review: OrganizationImportReview }) {
  const { readiness, summary } = review;
  const blocked = !readiness.canPublish;
  const noop = readiness.canPublish && readiness.createCount === 0;
  const title = blocked ? "Not ready to publish" : "Ready to publish";
  const detail = blocked
    ? `Resolve ${readiness.blockingIssueCount} blocking ${plural(readiness.blockingIssueCount, "issue", "issues")} before publishing.`
    : noop
      ? "Everything in this file already exists in Organization."
      : "The organization is structurally valid and ready to publish.";
  const Icon = blocked ? AlertCircle : CheckCircle2;

  return (
    <section
      aria-label="Review status"
      className={cn(
        "flex flex-wrap items-center gap-x-8 gap-y-5 rounded-surface border p-4 sm:pr-6 xl:flex-nowrap xl:gap-x-6",
        blocked
          ? "border-destructive/35 bg-linear-to-r from-destructive/[0.08] via-card to-card"
          : "border-success/35 bg-linear-to-r from-success/[0.09] via-card to-card"
      )}
    >
      <div className="flex min-w-0 flex-[2] basis-80 items-center gap-4 xl:min-w-64 xl:flex-1 xl:basis-0">
        <Icon
          aria-hidden
          strokeWidth={1.5}
          className={cn("size-12 shrink-0", blocked ? "text-destructive" : "text-success")}
        />
        <div className="min-w-0">
          <h2 className="type-page-title text-foreground">{title}</h2>
          <p className="mt-0.5 type-body text-muted-foreground xl:line-clamp-2">{detail}</p>
        </div>
      </div>
      <dl className="grid w-full grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4 lg:flex lg:w-auto lg:items-center lg:gap-0 lg:divide-x lg:divide-border lg:border-t-0 lg:pt-0 xl:min-w-0 xl:flex-initial">
        <Metric icon={Layers} value={String(summary.totalUnits)} label={plural(summary.totalUnits, "unit", "units")} />
        <Metric
          icon={Ban}
          value={String(readiness.blockingIssueCount)}
          label={plural(readiness.blockingIssueCount, "blocker", "blockers")}
          tone={readiness.blockingIssueCount > 0 ? "destructive" : undefined}
        />
        <Metric
          icon={TriangleAlert}
          value={String(readiness.warningCount)}
          label={plural(readiness.warningCount, "warning", "warnings")}
          tone={readiness.warningCount > 0 ? "warning" : undefined}
        />
        <Metric icon={CalendarDays} label="Effective" value={formatHumanDate(review.effectiveDate)} labelFirst />
      </dl>
    </section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  tone,
  labelFirst,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: "destructive" | "warning";
  labelFirst?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 lg:px-5 lg:first:pl-0 lg:last:pr-0 xl:shrink-0">
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn(
          "size-5 shrink-0",
          tone === "destructive" ? "text-destructive" : tone === "warning" ? "fill-warning/20 text-warning" : "text-muted-foreground"
        )}
      />
      <div className={cn("flex min-w-0", labelFirst ? "flex-col" : "flex-col-reverse")}>
        <dt className="type-meta text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "font-semibold text-foreground",
            labelFirst ? "type-body" : "type-body tabular-nums"
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

/** The shape of what will exist: units, root, and how many of each organization type. */
export function ReviewStructureSummary({ review }: { review: OrganizationImportReview }) {
  const { summary } = review;
  return (
    <section aria-labelledby="review-structure-title" className="rounded-surface border border-border bg-card p-5">
      <h2 id="review-structure-title" className="type-section-title text-foreground">
        Structure
      </h2>
      <ul className="mt-3 space-y-2">
        <Fact icon={Layers} value={summary.totalUnits} label={plural(summary.totalUnits, "unit", "units")} />
        {summary.existingUnits > 0 ? (
          <li className="pl-8 type-meta text-muted-foreground">
            {summary.newUnits} new · {summary.existingUnits} already in Organization
          </li>
        ) : null}
        <Fact icon={Network} value={summary.rootCount} label={plural(summary.rootCount, "root", "roots")} />
        <Fact
          icon={LayoutGrid}
          value={summary.countsByType.length}
          label={plural(summary.countsByType.length, "organization type", "organization types")}
        />
      </ul>
      {summary.countsByType.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {[...summary.countsByType].sort((a, b) => typeRank(a.typeName) - typeRank(b.typeName)).map((type) => (
            <li key={`${type.typeId}-${type.typeName}`} className="flex items-center gap-3 type-body">
              <ReviewTypeIcon typeName={type.typeName} className="text-muted-foreground" />
              <span className="w-6 text-right font-semibold tabular-nums text-foreground">{type.count}</span>
              <span className="text-muted-foreground">{pluralType(type.typeName, type.count)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Fact({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <li className="flex items-center gap-3 type-body">
      <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
      <span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>{" "}
        <span className="text-foreground">{label}</span>
      </span>
    </li>
  );
}

const TYPE_ORDER = ["organization", "businessunit", "division", "department", "team", "unit"];

/** Types read top-down, the way the hierarchy does; unfamiliar types come last. */
function typeRank(typeName: string) {
  const index = TYPE_ORDER.indexOf(typeName.toLowerCase().replace(/[^a-z]/g, ""));
  return index === -1 ? TYPE_ORDER.length : index;
}

/** "Business Unit" x4 reads "Business units". */
function pluralType(typeName: string, count: number) {
  const sentence = typeName.charAt(0).toUpperCase() + typeName.slice(1).toLowerCase();
  return count === 1 ? sentence : `${sentence}s`;
}

/** Which file this is and when it takes effect. */
export function ReviewImportContext({
  review,
  source,
}: {
  review: OrganizationImportReview;
  source: OrganizationImportSourceDto;
}) {
  const sheet = source.sourceFormat.toLowerCase() === "csv" ? null : source.selectedSheetName;
  return (
    <section aria-labelledby="review-context-title" className="rounded-surface border border-border bg-card p-5">
      <h2 id="review-context-title" className="type-section-title text-foreground">
        Import context
      </h2>
      <dl className="mt-3 space-y-2.5">
        <ContextRow icon={FileText} label="Source file" value={sheet ? `${source.originalFileName} · ${sheet}` : source.originalFileName} />
        <ContextRow icon={CalendarDays} label="Effective date" value={formatHumanDate(review.effectiveDate)} />
      </dl>
    </section>
  );
}

function ContextRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.25rem_7rem_minmax(0,1fr)] items-center gap-3 type-body">
      <Icon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}
