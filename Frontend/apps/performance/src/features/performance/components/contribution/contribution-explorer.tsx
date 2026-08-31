"use client";

import { useState } from "react";
import { ArrowLeft, Building2, ChevronRight, Target } from "lucide-react";
import type { ContributionContributorDto, ContributionNodeDto } from "@repo/api";
import { PageError, PageSkeleton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { PerformancePageHeading } from "../performance-page-heading";
import { useContribution, useContributionDetail } from "../../api/use-performance";
import { pct } from "../progress/progress-lib";

/**
 * The Contribution Explorer. Progress is the primary figure and is always stated as progress —
 * never the ambiguous "reported". Each objective declares its progress source: a Direct objective is
 * measured on itself and its aligned children are context, not contributors; a Calculated objective
 * rolls up from named weighted contributors, shown distinctly from mere alignment, with coverage as a
 * separate concept from progress.
 */
export function ContributionExplorer({ cycleId }: { cycleId: string }) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const overview = useContribution(cycleId, focusId === null);
  const detail = useContributionDetail(cycleId, focusId);

  // Root — the strategic objectives, no breadcrumb (the page title carries context).
  if (focusId === null) {
    if (overview.isLoading) {
      return (
        <>
          <PerformancePageHeading title="Contribution" />
          <PageSkeleton rows={4} label="Loading contribution" />
        </>
      );
    }
    if (overview.error || !overview.data) {
      return (
        <>
          <PerformancePageHeading title="Contribution" />
          <PageError
            title="Contribution unavailable"
            description={overview.error?.message}
            onRetry={overview.refetch}
          />
        </>
      );
    }
    return (
      <>
        <PerformancePageHeading
          title="Contribution"
          description="How progress rolls up through company direction."
        />
        {overview.data.roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published strategic direction yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overview.data.roots.map((node) => (
              <ContributionCard key={node.id} node={node} onDrill={() => setFocusId(node.id)} />
            ))}
          </div>
        )}
      </>
    );
  }

  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading contribution" />;
  if (detail.error || !detail.data) {
    return (
      <PageError
        title="Contribution unavailable"
        description={detail.error?.message}
        onRetry={detail.refetch}
      />
    );
  }

  const node = detail.data.node;
  const isCalculated = node.progressSource === "Calculated";
  const contributorIds = new Set(detail.data.contributors.map((c) => c.childObjectiveId));
  const alignedOnly = detail.data.children.filter((child) => !contributorIds.has(child.id));
  const reporting = detail.data.contributors.filter((c) => c.hasProgress).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb roots at "Contribution", never the Cycle name (already in the context bar). */}
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Contribution path">
        <button
          type="button"
          onClick={() => setFocusId(null)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Contribution
        </button>
        {[...detail.data.trail, node].map((crumb, index, all) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden />
            <button
              type="button"
              onClick={() => setFocusId(crumb.id)}
              disabled={index === all.length - 1}
              className={cn(
                "max-w-[18rem] truncate rounded-md px-2 py-1 font-medium transition-colors",
                index === all.length - 1
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {crumb.title}
            </button>
          </span>
        ))}
      </nav>

      {/* Spotlight. */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <ScopeLine node={node} />
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{node.title}</h2>
            {detail.data.description ? (
              <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{detail.data.description}</p>
            ) : null}
            <p className="mt-3 text-sm font-medium text-foreground">
              {isCalculated ? "Calculated from contributors" : "Direct measurement"}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-10">
            <ProgressReadout node={node} large />
            {isCalculated ? (
              <div>
                <p className="type-eyebrow text-muted-foreground">Coverage</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {reporting}
                  <span className="text-muted-foreground">/{detail.data.contributors.length}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">contributors reporting</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Contributors — calculated nodes only, weighted and distinct from alignment. */}
      {isCalculated && detail.data.contributors.length > 0 ? (
        <section className="space-y-3">
          <p className="type-eyebrow text-muted-foreground">Contributors</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="divide-y divide-border">
              {detail.data.contributors.map((contributor) => (
                <ContributorRow key={contributor.childObjectiveId} contributor={contributor} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Aligned objectives — support/context, explicitly not contributors. */}
      {(isCalculated ? alignedOnly : detail.data.children).length > 0 ? (
        <section className="space-y-3">
          <p className="type-eyebrow text-muted-foreground">
            Aligned objectives{isCalculated ? " · not contributors" : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(isCalculated ? alignedOnly : detail.data.children).map((child) => (
              <ContributionCard key={child.id} node={child} onDrill={() => setFocusId(child.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ScopeLine({ node }: { node: ContributionNodeDto }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {node.ownershipScope === "Company" ? (
        <Target className="size-3.5" aria-hidden />
      ) : (
        <Building2 className="size-3.5" aria-hidden />
      )}
      {node.ownershipScope === "Company" ? "Company" : (node.orgUnitName ?? "Organization unit")}
    </span>
  );
}

function ContributionCard({ node, onDrill }: { node: ContributionNodeDto; onDrill: () => void }) {
  const canDrill = node.childCount > 0;
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <ScopeLine node={node} />
        <span className="text-xs text-muted-foreground">
          {node.progressSource === "Calculated" ? "Calculated" : "Direct"}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground">{node.title}</h3>
      <div className="mt-3">
        <ProgressReadout node={node} />
      </div>
      {canDrill ? (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={onDrill}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Explore {node.childCount} aligned <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ContributorRow({ contributor }: { contributor: ContributionContributorDto }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
        {pct(contributor.weight)}% weight
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{contributor.title}</span>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums",
          contributor.hasProgress ? "text-foreground" : "text-muted-foreground/70"
        )}
      >
        {contributor.hasProgress ? `${pct(contributor.reportedProgress)}% progress` : "No progress yet"}
      </span>
    </div>
  );
}

function ProgressReadout({ node, large = false }: { node: ContributionNodeDto; large?: boolean }) {
  const complete = node.hasProgress && node.reportedProgress >= 100;
  return (
    <div className={large ? "min-w-32" : undefined}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-semibold tabular-nums",
            large ? "text-4xl" : "text-2xl",
            complete ? "text-success" : "text-foreground"
          )}
        >
          {node.hasProgress ? `${pct(node.reportedProgress)}%` : "—"}
        </span>
        <span className="text-xs text-muted-foreground">{node.hasProgress ? "progress" : "no progress yet"}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {node.hasProgress ? (
          <span
            className={cn("block h-full rounded-full", complete ? "bg-success" : "bg-primary")}
            style={{ width: `${Math.min(node.reportedProgress, 100)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
