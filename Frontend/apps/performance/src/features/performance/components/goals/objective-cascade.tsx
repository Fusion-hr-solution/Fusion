"use client";

import { useMemo } from "react";
import { Building2, ChevronRight, Gauge, Layers, Plus, Sigma, Target } from "lucide-react";
import type { GoalNodeDto, GoalsOverviewDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { buildGoalGraph, initials, pathTo, scopeLabel, STATE_LABEL, STATE_TONE } from "./goals-lib";

/**
 * The Organization Goals landing: a hierarchy-first Planning & Direction cascade driven by real
 * objective alignment (parent → child), not by the org chart. A published company strategic
 * objective is the root context; the organizational objectives aligned directly beneath it are
 * its branches. Depth is arbitrary — drilling a branch that has its own aligned objectives
 * refocuses the cascade on it, so the company is never rendered as one enormous tree.
 *
 * OrgUnit is shown only as an objective's ownership scope; the cascade never manufactures a branch
 * for a unit that has no objective, because the product asserts no rule that every unit must own
 * one. Empty means one true thing: nothing is established beneath this direction yet.
 */
export function ObjectiveCascade({
  overview,
  focusId,
  onFocus,
  onInspect,
  onCreateUnder,
  canAuthor,
}: {
  overview: GoalsOverviewDto;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  onInspect: (id: string) => void;
  onCreateUnder: (parent: GoalNodeDto) => void;
  canAuthor: boolean;
}) {
  const graph = useMemo(() => buildGoalGraph(overview.nodes), [overview.nodes]);
  const focus = focusId ? graph.byId.get(focusId) ?? null : null;

  if (!focus) {
    if (graph.roots.length === 0) return <NoDirection />;
    return (
      <div className="space-y-10">
        {graph.roots.map((root) => (
          <CascadeBlock
            key={root.id}
            root={root}
            childNodes={graph.childrenByParent.get(root.id) ?? []}
            canAuthor={canAuthor}
            onFocus={onFocus}
            onInspect={onInspect}
            onCreateUnder={onCreateUnder}
          />
        ))}
      </div>
    );
  }

  const trail = [...pathTo(graph, focus.id), focus];
  return (
    <div className="space-y-6">
      <Breadcrumb trail={trail} onFocus={onFocus} />
      <CascadeBlock
        root={focus}
        childNodes={graph.childrenByParent.get(focus.id) ?? []}
        canAuthor={canAuthor}
        onFocus={onFocus}
        onInspect={onInspect}
        onCreateUnder={onCreateUnder}
      />
    </div>
  );
}

/** A strategic (or focused) objective as the direction, with its aligned objectives cascading beneath. */
function CascadeBlock({
  root,
  childNodes,
  canAuthor,
  onFocus,
  onInspect,
  onCreateUnder,
}: {
  root: GoalNodeDto;
  childNodes: GoalNodeDto[];
  canAuthor: boolean;
  onFocus: (id: string | null) => void;
  onInspect: (id: string) => void;
  onCreateUnder: (parent: GoalNodeDto) => void;
}) {
  // A child can only be aligned beneath a published (baseline) parent — the server enforces this,
  // so the create affordance is offered only where it can succeed.
  const canAddHere = canAuthor && root.isAlignmentBaseline;
  const rootIsCalculated = root.progressSource === "Calculated";

  return (
    <section>
      <RootBand node={root} onInspect={onInspect} />

      {/* Cascade — the branches descend from the direction above via the connector rail. */}
      <div className="relative mt-1 pl-7">
        <span aria-hidden className="absolute left-3 top-0 h-3 w-px bg-border" />
        <p className="type-eyebrow mb-3 mt-2 flex items-center gap-2 text-muted-foreground">
          Organizational objectives
          {childNodes.length > 0 ? (
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {childNodes.length}
            </span>
          ) : null}
        </p>

        {childNodes.length === 0 ? (
          <div className="relative">
            <Tick />
            <EmptyCascade canAdd={canAddHere} onCreate={() => onCreateUnder(root)} />
          </div>
        ) : (
          <div className="relative space-y-3">
            {/* Rail spanning the branch group. */}
            <span aria-hidden className="absolute -left-4 top-2 bottom-6 w-px bg-border" />
            {childNodes.map((child) => (
              <div key={child.id} className="relative">
                <Tick />
                <BranchCard
                  node={child}
                  parentIsCalculated={rootIsCalculated}
                  onFocus={onFocus}
                  onInspect={onInspect}
                />
              </div>
            ))}
            {canAddHere ? (
              <div className="relative">
                <Tick />
                <button
                  type="button"
                  onClick={() => onCreateUnder(root)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03] hover:text-foreground"
                >
                  <Plus className="size-4" aria-hidden /> Add organizational objective
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

/** The connector tick joining a branch to the vertical rail. */
function Tick() {
  return <span aria-hidden className="absolute -left-4 top-6 h-px w-4 bg-border" />;
}

function RootBand({ node, onInspect }: { node: GoalNodeDto; onInspect: (id: string) => void }) {
  const isCompany = node.ownershipScope === "Company";
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        isCompany
          ? "border-primary/30 bg-gradient-to-br from-primary/[0.07] via-primary/[0.02] to-transparent"
          : "bg-card shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="type-eyebrow inline-flex items-center gap-1.5 text-muted-foreground">
          {isCompany ? (
            <>
              <Target className="size-3.5 text-primary" aria-hidden /> Company strategic objective
            </>
          ) : (
            <>
              <Building2 className="size-3.5" aria-hidden /> {scopeLabel(node)}
              <span className="font-normal normal-case tracking-normal text-muted-foreground/60">· Org unit</span>
            </>
          )}
        </span>
        <StatusBadge tone={STATE_TONE[node.state]} dot>
          {STATE_LABEL[node.state]}
        </StatusBadge>
      </div>

      <button type="button" onClick={() => onInspect(node.id)} className="mt-2.5 block text-left">
        <h2 className={cn("font-semibold tracking-tight hover:underline", isCompany ? "text-xl" : "text-lg")}>
          {node.title}
        </h2>
      </button>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <Accountable name={node.accountablePersonName} />
        <Measurement node={node} />
      </div>
    </div>
  );
}

function BranchCard({
  node,
  parentIsCalculated,
  onFocus,
  onInspect,
}: {
  node: GoalNodeDto;
  parentIsCalculated: boolean;
  onFocus: (id: string | null) => void;
  onInspect: (id: string) => void;
}) {
  const contributes = parentIsCalculated && node.contributionToParent != null;
  const hasChildren = node.childCount > 0;

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-colors hover:border-primary/40",
        contributes && "ring-1 ring-primary/20"
      )}
    >
      {/* Contribution weight — only where the parent rolls up from configured children. */}
      {contributes ? (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
          <Sigma className="size-3" aria-hidden /> {node.contributionToParent}%
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Building2 className="size-3.5" aria-hidden /> {scopeLabel(node)}
          <span className="text-muted-foreground/50">· Org unit</span>
        </span>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onFocus(node.id)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            {node.childCount} aligned <ChevronRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <StatusBadge tone={STATE_TONE[node.state]} dot>
          {STATE_LABEL[node.state]}
        </StatusBadge>
        <button
          type="button"
          onClick={() => onInspect(node.id)}
          className="min-w-0 truncate text-left text-sm font-semibold tracking-tight hover:underline"
        >
          {node.title}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <Accountable name={node.accountablePersonName} compact />
        <Measurement node={node} compact />
      </div>
    </div>
  );
}

function Accountable({ name, compact }: { name: string | null; compact?: boolean }) {
  return (
    <div>
      <p className="type-eyebrow text-muted-foreground/70">Accountable</p>
      <span className="mt-1 flex items-center gap-2 text-sm font-medium">
        <Avatar className={compact ? "size-5" : "size-6"}>
          <AvatarFallback className={compact ? "text-[9px]" : "text-[10px]"}>{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{name ?? "Unassigned"}</span>
      </span>
    </div>
  );
}

function Measurement({ node, compact }: { node: GoalNodeDto; compact?: boolean }) {
  const summary = node.measurementSummary?.trim();
  if (!summary) return null;
  const Icon = node.progressSource === "Calculated" ? Layers : Gauge;
  return (
    <div className={cn(compact ? "text-left" : "text-right")}>
      <p className={cn("type-eyebrow text-muted-foreground/70", compact ? "text-left" : "text-right")}>Measurement</p>
      <span className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        {summary}
      </span>
    </div>
  );
}

function EmptyCascade({ canAdd, onCreate }: { canAdd: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">No organizational objectives beneath this direction yet.</p>
      {canAdd ? (
        <Button className="mt-3" size="sm" onClick={onCreate}>
          <Plus className="size-4" data-icon="inline-start" /> Add organizational objective
        </Button>
      ) : null}
    </div>
  );
}

function NoDirection() {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center">
      <Target className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm font-medium">No strategic direction yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Publish company strategic objectives in Cycle setup. Organizational objectives align beneath them.
      </p>
    </div>
  );
}

function Breadcrumb({ trail, onFocus }: { trail: GoalNodeDto[]; onFocus: (id: string | null) => void }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Direction path">
      <button
        type="button"
        onClick={() => onFocus(null)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Target className="size-3.5" aria-hidden />
        Direction
      </button>
      {trail.map((node, index) => {
        const isLast = index === trail.length - 1;
        return (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden />
            <button
              type="button"
              onClick={() => onFocus(node.id)}
              disabled={isLast}
              className={cn(
                "max-w-[16rem] truncate rounded-md px-2 py-1 font-medium transition-colors",
                isLast ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {node.title}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
