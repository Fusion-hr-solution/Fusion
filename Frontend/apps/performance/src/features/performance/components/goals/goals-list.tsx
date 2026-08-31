"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GoalNodeDto, GoalsOverviewDto, ObjectiveLifecycleState } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Input } from "@repo/ds/components/ui/input";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { initials, scopeLabel, STATE_LABEL, STATE_TONE } from "./goals-lib";

type Filter = "all" | ObjectiveLifecycleState;

export function GoalsList({ overview, onInspect }: { overview: GoalsOverviewDto; onInspect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filters: { key: Filter; label: string; count: number }[] = useMemo(() => {
    const org = overview.nodes.filter((node) => node.ownershipScope === "OrgUnit");
    return [
      { key: "all", label: "All", count: overview.nodes.length },
      { key: "Draft", label: "Draft", count: org.filter((n) => n.state === "Draft").length },
      { key: "Published", label: "Published", count: org.filter((n) => n.state === "Published").length },
    ];
  }, [overview.nodes]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return overview.nodes
      .filter((node) => {
        if (filter !== "all") return node.state === filter;
        return true;
      })
      .filter((node) =>
        term === "" ||
        node.title.toLowerCase().includes(term) ||
        (node.accountablePersonName ?? "").toLowerCase().includes(term) ||
        scopeLabel(node).toLowerCase().includes(term)
      )
      .sort((a, b) => a.ownershipScope.localeCompare(b.ownershipScope) || a.title.localeCompare(b.title));
  }, [overview.nodes, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === item.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
              <span className="text-xs tabular-nums opacity-70">{item.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search objectives" className="pl-9" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No objectives match.
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border">
          {rows.map((node) => (
            <GoalRow key={node.id} node={node} onInspect={onInspect} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({ node, onInspect }: { node: GoalNodeDto; onInspect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onInspect(node.id)}
      className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{node.title}</p>
        <p className="truncate text-xs text-muted-foreground">{scopeLabel(node)} · {node.measurementSummary}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Avatar className="size-6"><AvatarFallback className="text-[10px]">{initials(node.accountablePersonName)}</AvatarFallback></Avatar>
        <span className="max-w-40 truncate text-sm text-muted-foreground">{node.accountablePersonName ?? "—"}</span>
      </div>
      <StatusBadge tone={STATE_TONE[node.state]} dot>{STATE_LABEL[node.state]}</StatusBadge>
    </button>
  );
}
