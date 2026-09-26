"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@repo/ds";
import type { OrganizationImportSemanticAssistance } from "@repo/api";
import { describeAssistance } from "../model/match-assistance";

export type MatchFact = { value: string; label: string; emphasis?: boolean };

/**
 * The Match headline. Fusion asks for help when it understood too little to lean on; otherwise it
 * says how much it matched, crediting AI only when AI actually matched something.
 */
export function matchHeadline({
  needsReview,
  mostlyUnresolved,
  byAi,
  noun = "data",
}: {
  needsReview: number;
  mostlyUnresolved: boolean;
  byAi: boolean;
  noun?: string;
}): React.ReactNode {
  if (needsReview > 0 && mostlyUnresolved) return "We need your help matching this file";
  const how = needsReview === 0 ? "all" : "most";
  return byAi ? (
    <>
      <AiMark /> matched {how} of your {noun}
    </>
  ) : (
    `We’ve matched ${how} of your ${noun}`
  );
}

function AiMark() {
  return (
    <span className="bg-[linear-gradient(90deg,#22d3ee_0%,#3b82f6_35%,#a855f7_70%,#e879f9_100%)] bg-clip-text font-bold text-transparent saturate-150">
      AI
    </span>
  );
}

/** Opening summary of Match: what Fusion understood, and how much is left for the administrator. */
export function ImportMatchBanner({
  headline,
  assistance,
  needsReview,
  facts,
  children,
}: {
  headline: React.ReactNode;
  assistance: OrganizationImportSemanticAssistance | null | undefined;
  needsReview: number;
  facts: MatchFact[];
  /** What automatic matching can still do, rendered under the summary sentence. */
  children?: React.ReactNode;
}) {
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
          <h2 className="mt-1 type-page-title text-foreground">{headline}</h2>
          <p className="mt-1 type-body text-muted-foreground">{describeAssistance(assistance, needsReview).summary}</p>
          {children}
        </div>
      </div>
      <dl className="grid w-full shrink-0 grid-cols-1 gap-4 border-t border-border pt-4 sm:flex sm:w-auto sm:items-start sm:gap-0 sm:divide-x sm:divide-border sm:border-t-0 sm:pt-0">
        {facts.map((fact) => (
          <Fact key={fact.label} {...fact} />
        ))}
      </dl>
    </section>
  );
}

function Fact({ value, label, emphasis }: MatchFact) {
  const tone = emphasis ? "text-primary-foreground dark:text-primary" : "text-foreground";
  return (
    <div className="flex flex-col-reverse gap-1.5 sm:px-6 sm:py-1 sm:first:pl-0 sm:last:pr-2">
      <dt className={cn("type-meta sm:max-w-32", emphasis ? tone : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("type-metric font-semibold whitespace-nowrap tabular-nums leading-none", tone)}>{value}</dd>
    </div>
  );
}
