"use client";

import { useState } from "react";
import { Building2, ChevronRight, Layers, Sigma, Target } from "lucide-react";
import type { ContributionNodeDto } from "@repo/api";
import { PageError, PageSkeleton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { useContribution, useContributionDetail } from "../../api/use-performance";
import { pct } from "../progress/progress-lib";

/**
 * The Contribution Explorer — organizational direction with reported progress as the primary figure
 * and reporting coverage as quieter context, drilling from company strategy into organizational scope
 * while preserving breadcrumb context. Progress and coverage are never styled as interchangeable
 * metrics; a calculated node's contribution weights are shown, alignment alone never is.
 */
export function ContributionExplorer({ cycleId, cycleName }: { cycleId: string; cycleName: string }) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const overview = useContribution(cycleId, focusId === null);
  const detail = useContributionDetail(cycleId, focusId);

  if (focusId === null) {
    if (overview.isLoading) return <PageSkeleton rows={4} label="Loading contribution" />;
    if (overview.error || !overview.data) {
      return <PageError title="Contribution unavailable" description={overview.error?.message} onRetry={overview.refetch} />;
    }
    return (
      <div className="space-y-5">
        <Breadcrumb cycleName={cycleName} trail={[]} onRoot={() => setFocusId(null)} onNode={setFocusId} />
        {overview.data.roots.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No published strategic direction yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overview.data.roots.map((node) => (
              <ContributionCard key={node.id} node={node} onDrill={() => setFocusId(node.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading contribution" />;
  if (detail.error || !detail.data) {
    return <PageError title="Contribution unavailable" description={detail.error?.message} onRetry={detail.refetch} />;
  }

  const node = detail.data.node;
  return (
    <div className="space-y-6">
      <Breadcrumb cycleName={cycleName} trail={[...detail.data.trail, node]} onRoot={() => setFocusId(null)} onNode={setFocusId} />

      {/* Spotlight — reported progress primary, coverage quiet. */}
      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {node.ownershipScope === "Company" ? <Target className="size-3.5" aria-hidden /> : <Building2 className="size-3.5" aria-hidden />}
              {node.ownershipScope === "Company" ? "Company" : node.orgUnitName ?? "Organization unit"}
            </span>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{node.title}</h2>
            {detail.data.description ? <p className="mt-1 max-w-prose text-sm text-muted-foreground">{detail.data.description}</p> : null}
          </div>
          <ProgressReadout node={node} large />
        </div>
      </section>

      {/* Configured contributors for a calculated node — distinct from mere alignment. */}
      {node.progressSource === "Calculated" && detail.data.contributors.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sigma className="size-4 text-primary" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contributors</span>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="divide-y">
              {detail.data.contributors.map((contributor) => (
                <div key={contributor.childObjectiveId} className="flex items-center gap-4 px-5 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                    {pct(contributor.weight)}%
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{contributor.title}</span>
                  <span className={cn("text-sm tabular-nums", !contributor.hasProgress && "text-muted-foreground/60")}>
                    {contributor.hasProgress ? `${pct(contributor.reportedProgress)}%` : "Not reported"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Aligned children to drill into. */}
      {detail.data.children.length > 0 ? (
        <section className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Organizational objectives</span>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {detail.data.children.map((child) => (
              <ContributionCard key={child.id} node={child} onDrill={() => setFocusId(child.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Breadcrumb({
  cycleName,
  trail,
  onRoot,
  onNode,
}: {
  cycleName: string;
  trail: ContributionNodeDto[];
  onRoot: () => void;
  onNode: (id: string) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Contribution path">
      <button type="button" onClick={onRoot} className={cn("rounded-md px-2 py-1 font-medium transition-colors hover:bg-muted", trail.length > 0 ? "text-muted-foreground hover:text-foreground" : "text-foreground")}>
        <Building2 className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
        {cycleName}
      </button>
      {trail.map((node, index) => (
        <span key={node.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden />
          <button
            type="button"
            onClick={() => onNode(node.id)}
            disabled={index === trail.length - 1}
            className={cn("max-w-[16rem] truncate rounded-md px-2 py-1 font-medium transition-colors", index === trail.length - 1 ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            {node.title}
          </button>
        </span>
      ))}
    </nav>
  );
}

function ContributionCard({ node, onDrill }: { node: ContributionNodeDto; onDrill: () => void }) {
  const canDrill = node.childCount > 0;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {node.ownershipScope === "Company" ? <Target className="size-3.5" aria-hidden /> : <Building2 className="size-3.5" aria-hidden />}
          {node.ownershipScope === "Company" ? "Company" : node.orgUnitName ?? "Organization"}
        </span>
        {node.progressSource === "Calculated" ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="size-3" aria-hidden /> Calculated
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 text-sm font-semibold tracking-tight">{node.title}</h3>
      <div className="mt-3">
        <ProgressReadout node={node} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
        {canDrill ? (
          <button type="button" onClick={onDrill} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Explore {node.childCount} <ChevronRight className="size-3.5" aria-hidden />
          </button>
        ) : (
          <span className="text-muted-foreground/60">{node.contributorCount > 0 ? `${node.contributorCount} contributors` : "No sub-objectives"}</span>
        )}
      </div>
    </div>
  );
}

function ProgressReadout({ node, large = false }: { node: ContributionNodeDto; large?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-semibold tabular-nums", large ? "text-4xl" : "text-2xl", node.reportedProgress >= 100 && node.hasProgress ? "text-success" : "text-foreground")}>
          {node.hasProgress ? `${pct(node.reportedProgress)}%` : "—"}
        </span>
        <span className="text-xs text-muted-foreground">{node.hasProgress ? "reported" : "no progress"}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {node.hasProgress ? (
          <span className={cn("block h-full rounded-full", node.reportedProgress >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${Math.min(node.reportedProgress, 100)}%` }} />
        ) : null}
      </div>
      {/* Coverage — quieter than progress, never an interchangeable KPI. */}
      {node.coverage != null ? (
        <p className="mt-1.5 text-xs text-muted-foreground/80">
          {pct(node.coverage)}% of contribution reporting
        </p>
      ) : null}
    </div>
  );
}
