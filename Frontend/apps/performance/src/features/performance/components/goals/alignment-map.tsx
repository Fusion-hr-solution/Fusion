"use client";

import { useMemo } from "react";
import { Building2, ChevronRight, CornerDownRight, Layers, Plus, Sigma, Target } from "lucide-react";
import type { GoalNodeDto, GoalsOverviewDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { buildGoalGraph, initials, pathTo, scopeLabel, STATE_LABEL, STATE_TONE } from "./goals-lib";

/**
 * The Alignment Map — a focus-plus-context view of the objective hierarchy. One level of children
 * is shown beneath the focused objective; selecting a child refocuses the map, so arbitrary depth
 * is navigable without rendering the whole company at once. Alignment is the primary relationship;
 * contribution weight is shown only on the connectors of a calculated parent's configured children.
 */
export function AlignmentMap({
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
  const trail = focus ? pathTo(graph, focus.id) : [];
  const children = focus ? graph.childrenByParent.get(focus.id) ?? [] : graph.roots;

  return (
    <div className="space-y-6">
      {/* Breadcrumb context — only while focused; the root level needs no crumb
          (the Cycle name already sits in the context bar above). */}
      {focus ? (
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Alignment path">
        <button
          type="button"
          onClick={() => onFocus(null)}
          className="rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Building2 className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
          Direction
        </button>
        {[...trail, ...(focus ? [focus] : [])].map((node, index, all) => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden />
            <button
              type="button"
              onClick={() => onFocus(node.id)}
              disabled={index === all.length - 1}
              className={cn(
                "max-w-[16rem] truncate rounded-md px-2 py-1 font-medium transition-colors",
                index === all.length - 1 ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {node.title}
            </button>
          </span>
        ))}
      </nav>
      ) : null}

      {focus ? (
        <FocusView
          focus={focus}
          childNodes={children}
          canAuthor={canAuthor}
          onFocus={onFocus}
          onInspect={onInspect}
          onCreateUnder={onCreateUnder}
        />
      ) : (
        <CompanyView roots={children} onFocus={onFocus} onInspect={onInspect} />
      )}
    </div>
  );
}

function CompanyView({
  roots,
  onFocus,
  onInspect,
}: {
  roots: GoalNodeDto[];
  onFocus: (id: string) => void;
  onInspect: (id: string) => void;
}) {
  if (roots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Target className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium">No strategic direction yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Publish strategic objectives in Cycle setup. Organizational objectives align beneath them.
        </p>
      </div>
    );
  }
  return (
    <section className="space-y-4">
      <p className="type-eyebrow text-muted-foreground">Strategic direction</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roots.map((node) => (
          <ObjectiveCard key={node.id} node={node} onFocus={onFocus} onInspect={onInspect} />
        ))}
      </div>
    </section>
  );
}

function FocusView({
  focus,
  childNodes,
  canAuthor,
  onFocus,
  onInspect,
  onCreateUnder,
}: {
  focus: GoalNodeDto;
  childNodes: GoalNodeDto[];
  canAuthor: boolean;
  onFocus: (id: string) => void;
  onInspect: (id: string) => void;
  onCreateUnder: (parent: GoalNodeDto) => void;
}) {
  return (
    <div className="space-y-0">
      {/* Spotlight */}
      <div className="mx-auto max-w-2xl">
        <ObjectiveCard node={focus} variant="spotlight" onInspect={onInspect} />
      </div>

      {/* Trunk connector */}
      <div className="flex justify-center" aria-hidden>
        <span className="h-6 w-px bg-border" />
      </div>

      {childNodes.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">No aligned objectives yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {focus.ownershipScope === "Company"
              ? "Create the first organizational objective under this direction."
              : "Create a lower-level objective that supports this one."}
          </p>
          {canAuthor ? (
            <Button className="mt-4" size="sm" onClick={() => onCreateUnder(focus)}>
              <Plus className="size-3.5" data-icon="inline-start" /> Add objective
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Rail spanning the children group */}
          <div className="mx-auto flex w-full max-w-5xl items-center" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" aria-hidden />
              {focus.progressSource === "Calculated" ? "Contributes to progress" : "Supports"} · {childNodes.length}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {childNodes.map((node) => (
              <ObjectiveCard
                key={node.id}
                node={node}
                parentIsCalculated={focus.progressSource === "Calculated"}
                onFocus={onFocus}
                onInspect={onInspect}
              />
            ))}
            {canAuthor ? (
              <button
                type="button"
                onClick={() => onCreateUnder(focus)}
                className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.03] hover:text-foreground"
              >
                <Plus className="size-4" aria-hidden />
                Add objective
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectiveCard({
  node,
  variant = "node",
  parentIsCalculated,
  onFocus,
  onInspect,
}: {
  node: GoalNodeDto;
  variant?: "node" | "spotlight";
  parentIsCalculated?: boolean;
  onFocus?: (id: string) => void;
  onInspect: (id: string) => void;
}) {
  const isSpotlight = variant === "spotlight";
  const contributes = parentIsCalculated && node.contributionToParent != null;
  const ScopeIcon = node.ownershipScope === "Company" ? Target : Building2;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-card p-4 transition-colors",
        isSpotlight ? "border-primary/40 bg-primary/[0.04] p-5 shadow-sm" : "hover:border-primary/40",
        contributes && "ring-1 ring-primary/25"
      )}
    >
      {/* Contribution weight — only where the parent is calculated and this child is configured. */}
      {contributes ? (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
          <Sigma className="size-3" aria-hidden /> {node.contributionToParent}%
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ScopeIcon className="size-3.5" aria-hidden /> {scopeLabel(node)}
        </span>
        <StatusBadge tone={STATE_TONE[node.state]} dot>
          {STATE_LABEL[node.state]}
        </StatusBadge>
      </div>

      <button
        type="button"
        onClick={() => onInspect(node.id)}
        className="mt-2 block text-left"
      >
        <h3 className={cn("font-semibold tracking-tight hover:underline", isSpotlight ? "text-lg" : "text-sm")}>
          {node.title}
        </h3>
      </button>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="size-5">
          <AvatarFallback className="text-[9px]">{initials(node.accountablePersonName)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{node.accountablePersonName ?? "Unassigned"}</span>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {node.progressSource === "Calculated" ? <Layers className="size-3.5" aria-hidden /> : <Target className="size-3.5" aria-hidden />}
        <span className="truncate">{node.measurementSummary}</span>
      </p>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        {onFocus && node.childCount > 0 ? (
          <button
            type="button"
            onClick={() => onFocus(node.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Explore {node.childCount} aligned <ChevronRight className="size-3.5" aria-hidden />
          </button>
        ) : (
          <span className="text-xs text-muted-foreground/60">{node.childCount > 0 ? `${node.childCount} aligned` : "No aligned objectives"}</span>
        )}
        <button type="button" onClick={() => onInspect(node.id)} className="text-xs text-muted-foreground hover:text-foreground">
          Inspect
        </button>
      </div>
    </div>
  );
}
