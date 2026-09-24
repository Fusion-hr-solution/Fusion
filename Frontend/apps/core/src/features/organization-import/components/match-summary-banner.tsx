"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@repo/ds";
import type { OrganizationImportMatch, OrganizationImportShape } from "@repo/api";
import { describeAssistance } from "../model/match-assistance";

const SHAPE_LABEL: Record<OrganizationImportShape, string> = {
  Native: "Fusion template",
  ParentReference: "Parent-referenced",
  LevelColumns: "Level columns",
  Unresolved: "Not recognised",
};

export type MatchSummary = {
  shapeLabel: string;
  shapeResolved: boolean;
  typesTotal: number;
  typesResolved: number;
  needsReview: number;
};

export function summarizeMatch(match: OrganizationImportMatch): MatchSummary {
  const plan = match.mappingPlan;
  const decisions = match.readiness.requiredDecisions;
  const types = plan.typeMappingDetails ?? [];
  const unresolvedTypes = new Set(
    decisions.filter((d) => d.kind === "TypeMapping").map((d) => d.sourceValue ?? "")
  );
  return {
    shapeLabel: SHAPE_LABEL[plan.sourceShape],
    shapeResolved: plan.sourceShape !== "Unresolved",
    typesTotal: types.length,
    typesResolved: types.filter((t) => !unresolvedTypes.has(t.sourceValue)).length,
    needsReview: decisions.length,
  };
}

function headline(
  { needsReview, typesResolved, typesTotal, shapeResolved }: MatchSummary,
  byAi: boolean
): React.ReactNode {
  if (needsReview > 0 && (!shapeResolved || typesResolved * 2 < typesTotal)) return "We need your help matching this file";
  // Credit AI only when it actually matched something; otherwise Fusion's own rules did.
  const who = byAi ? <AiMark /> : "We’ve";
  const how = needsReview === 0 ? "all" : "most";
  return byAi ? <>{who} matched {how} of your data</> : `${who} matched ${how} of your data`;
}

function AiMark() {
  return (
    <span className="bg-[linear-gradient(90deg,#22d3ee_0%,#3b82f6_35%,#a855f7_70%,#e879f9_100%)] bg-clip-text font-bold text-transparent saturate-150">
      AI
    </span>
  );
}

/** Opening summary of Match: what Fusion understood, and how much is left for the administrator. */
export function MatchSummaryBanner({
  match,
  children,
}: {
  match: OrganizationImportMatch;
  /** What automatic matching can still do, rendered under the summary sentence. */
  children?: React.ReactNode;
}) {
  const summary = summarizeMatch(match);
  const pending = summary.needsReview > 0;
  return (
    <section
      aria-label="Match summary"
      className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-surface border border-primary/30 bg-linear-to-r from-primary/[0.07] via-card to-card p-4 sm:pr-6"
    >
      <div className="flex min-w-0 flex-[2] basis-96 items-center gap-5">
        <span
          aria-hidden
          className="hidden size-20 shrink-0 place-items-center sm:grid rounded-full bg-primary/15 text-primary-foreground ring-1 ring-primary/25 dark:text-primary"
        >
          <Sparkles className="size-9" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="type-eyebrow tracking-[0.12em] text-primary-foreground dark:text-primary">
            Fusion understood your file
          </p>
          <h2 className="mt-1 type-page-title text-foreground">{headline(summary, (match.semanticAssistance?.appliedCount ?? 0) > 0)}</h2>
          <p className="mt-1 type-body text-muted-foreground">
            {describeAssistance(match.semanticAssistance, summary.needsReview).summary}
          </p>
          {children}
        </div>
      </div>
      <dl className="grid w-full shrink-0 grid-cols-1 gap-4 border-t border-border pt-4 sm:flex sm:w-auto sm:items-start sm:gap-0 sm:divide-x sm:divide-border sm:border-t-0 sm:pt-0">
        <Fact value={summary.shapeLabel} label="Hierarchy" />
        <Fact
          value={summary.typesTotal ? `${summary.typesResolved}/${summary.typesTotal}` : "0"}
          label="Organization types resolved"
        />
        <Fact value={String(summary.needsReview)} label="Needs review" emphasis={pending} />
      </dl>
    </section>
  );
}

function Fact({ value, label, emphasis }: { value: string; label: string; emphasis?: boolean }) {
  const tone = emphasis ? "text-primary-foreground dark:text-primary" : "text-foreground";
  return (
    <div className="flex flex-col-reverse gap-1.5 sm:px-6 sm:py-1 sm:first:pl-0 sm:last:pr-2">
      <dt className={cn("type-meta sm:max-w-32", emphasis ? tone : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("type-metric font-semibold whitespace-nowrap tabular-nums leading-none", tone)}>{value}</dd>
    </div>
  );
}
