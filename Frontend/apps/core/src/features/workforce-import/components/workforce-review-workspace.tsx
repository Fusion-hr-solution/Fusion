"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Skeleton, cn } from "@repo/ds";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import { useQueryClient } from "@tanstack/react-query";
import {
  coreWorkforceImportQueryKeys,
  translateWorkforceImportError,
  type WorkforceDecisionRequest,
  type WorkforceImportSessionDto,
  type WorkforceIssueCategory,
  type WorkforceReviewIssueGroupDto,
  type WorkforceReviewResult,
  type WorkforceReviewRowDto,
} from "@repo/api";
import { ChevronRight, Search, X } from "lucide-react";
import { EmployeeIdentity, formatWorkforceDate } from "@/features/people/components/workforce-ui";
import { WorkforceReviewInspector } from "./workforce-review-inspector";
import { useWorkforceImportApi, useWorkforceReview } from "../api/use-workforce-import";

const PAGE_SIZE = 20;

/** Track a media query without SSR mismatch (defaults to desktop until mounted). */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}
const FILTERS: Array<{ key: string; label: string; count: (s: WorkforceImportSessionDto["counts"]) => number; unit?: string; tone?: StatusTone }> = [
  { key: "NeedsAttention", label: "To decide", count: (c) => c.needsAttentionCount, tone: "warning" },
  { key: "NewEmployee", label: "Ready", count: (c) => c.newCount },
  { key: "ExistingAnchor", label: "Existing", count: (c) => c.existingAnchorCount },
  { key: "Excluded", label: "Excluded", count: (c) => c.excludedCount },
];

// What each kind of remaining decision *is*, in product language — so the review says "3 organizations
// to match · 40 people" instead of one alarming "57 need attention" total. `scope` shows the affected
// people only when a decision genuinely fans out (grouping collapses many rows into one choice).
const CATEGORY_COPY: Record<WorkforceIssueCategory, { one: string; many: string; verb: string; error?: boolean }> = {
  organization: { one: "organization", many: "organizations", verb: "to match" },
  workdate: { one: "work date", many: "work dates", verb: "to establish" },
  manager: { one: "manager", many: "managers", verb: "to confirm" },
  difference: { one: "existing record", many: "existing records", verb: "to review" },
  identity: { one: "identity", many: "identities", verb: "to check" },
  lifecycle: { one: "row", many: "rows", verb: "to review" },
  data: { one: "row", many: "rows", verb: "to fix in your file", error: true },
};

function describeGroup(g: WorkforceReviewIssueGroupDto): { label: string; scope: string | null; error: boolean } {
  const copy = CATEGORY_COPY[g.category];
  const noun = g.decisionCount === 1 ? copy.one : copy.many;
  return {
    label: `${g.decisionCount} ${noun} ${copy.verb}`,
    scope: g.affectedPeople > g.decisionCount ? `${g.affectedPeople} people` : null,
    error: copy.error ?? false,
  };
}

const RESULT_TONE: Record<WorkforceReviewResult, StatusTone> = {
  New: "success",
  Existing: "muted",
  NeedsAttention: "warning",
  Excluded: "neutral",
};
const RESULT_LABEL: Record<WorkforceReviewResult, string> = {
  New: "New",
  Existing: "Existing",
  NeedsAttention: "Needs attention",
  Excluded: "Excluded",
};

export function WorkforceReviewWorkspace({
  session,
  onSession,
  onCommit,
  onFinishNoWork,
  committing,
  outdatedBanner,
}: {
  session: WorkforceImportSessionDto;
  onSession: (session: WorkforceImportSessionDto) => void;
  onCommit: () => void;
  onFinishNoWork: () => void;
  committing: boolean;
  outdatedBanner?: React.ReactNode;
}) {
  const api = useWorkforceImportApi();
  const queryClient = useQueryClient();
  const counts = session.counts;
  const hasBlockers = counts.needsAttentionCount > 0;

  const [filter, setFilter] = useState<string>(hasBlockers ? "NeedsAttention" : "NewEmployee");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const wide = useMediaQuery("(min-width: 1024px)");
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const review = useWorkforceReview(session.id, { filter, query: search, page, pageSize: PAGE_SIZE });
  const rows = useMemo(() => review.data?.rows ?? [], [review.data]);
  // Distinct decisions still to make (grouped), not the affected-employee count.
  const openIssues = review.data?.summary.counts.openIssueCount ?? counts.needsAttentionCount;
  // The remaining work broken down by kind, computed session-wide by the server (not from the current
  // page) so the breakdown and the temporal band are stable regardless of which rows are visible.
  const issueGroups = useMemo(() => review.data?.summary.issueGroups ?? [], [review.data]);
  const temporalGroup = useMemo(() => issueGroups.find((g) => g.category === "workdate"), [issueGroups]);

  // When the last blocker clears, don't strand the reviewer on an empty "Needs attention"
  // view — reveal the workforce being created so the Ready region is the real confirmation.
  useEffect(() => {
    if (counts.needsAttentionCount === 0 && filter === "NeedsAttention") {
      setFilter("NewEmployee");
      setPage(1);
    }
  }, [counts.needsAttentionCount, filter]);

  // Keep a meaningful selection: first blocker, else first row.
  useEffect(() => {
    if (rows.length === 0) { setSelected(null); return; }
    if (selected !== null && rows.some((r) => r.sourceRowNumber === selected)) return;
    const firstBlocker = rows.find((r) => r.result === "NeedsAttention");
    setSelected((firstBlocker ?? rows[0])!.sourceRowNumber);
  }, [rows, selected]);

  const selectedRow = useMemo(() => rows.find((r) => r.sourceRowNumber === selected) ?? null, [rows, selected]);

  const applyDecision = useCallback(
    async (decision: WorkforceDecisionRequest) => {
      setBusy(true);
      setError(null);
      const keepSelected = selected;
      try {
        const summary = await api.decide(session.id, session.version, decision);
        // Update session counts/version without a full-page rebuild.
        onSession({
          ...session,
          version: summary.version,
          counts: {
            newCount: summary.counts.new,
            existingAnchorCount: summary.counts.existing,
            needsAttentionCount: summary.counts.needsAttention,
            excludedCount: summary.counts.excluded,
          },
        });
        // Refetch the current review page in place (keepPreviousData avoids a flash).
        await queryClient.invalidateQueries({ queryKey: coreWorkforceImportQueryKeys.all() });
        if (summary.affectedRows > 1) {
          // Restrained reveal on the rows that changed meaning.
          setRevealed(new Set(rows.map((r) => r.sourceRowNumber)));
          setTimeout(() => setRevealed(new Set()), 1400);
        }
        // Advance to the next item needing attention when the resolved one clears.
        setSelected(keepSelected);
      } catch (e) {
        setError(translateWorkforceImportError(e).message);
      } finally {
        setBusy(false);
      }
    },
    [api, session, selected, rows, onSession, queryClient]
  );

  const goToNextAttention = useCallback(() => {
    if (filter !== "NeedsAttention") { setFilter("NeedsAttention"); setPage(1); return; }
    const idx = rows.findIndex((r) => r.sourceRowNumber === selected);
    const next = rows.slice(idx + 1).find((r) => r.result === "NeedsAttention") ?? rows.find((r) => r.result === "NeedsAttention");
    if (next) setSelected(next.sourceRowNumber);
  }, [filter, rows, selected]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {outdatedBanner}

      {/* Outcome first: lead with how many are ready, then name the remaining work by its kind
          (small decision counts) — never a single alarming "N need attention" total. */}
      <div className="border-b border-border px-6 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[1.75rem] font-semibold leading-none tabular-nums text-foreground">{counts.newCount}</span>
              <span className="type-body text-muted-foreground">
                {counts.newCount === 1 ? "person" : "people"} ready to import
                {hasBlockers ? (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground tabular-nums">{openIssues}</span>{" "}
                    {openIssues === 1 ? "decision" : "decisions"} before you add the rest
                  </>
                ) : null}
              </span>
            </div>
            {issueGroups.length > 0 ? (
              <ReviewBreakdown groups={issueGroups} onPick={() => { setFilter("NeedsAttention"); setPage(1); }} />
            ) : null}
          </div>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search people…" className="h-8 w-56 pl-8 type-meta" />
          </div>
        </div>
      </div>

      {/* Quiet filter tabs — navigation between result groups, not the headline. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-6 py-1.5">
        {FILTERS.map((f) => {
          const n = f.count(counts);
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 type-meta transition-colors",
                active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.tone && n > 0 ? <span className={cn("size-1.5 rounded-full", f.tone === "warning" ? "bg-[var(--color-warning)]" : "bg-current")} aria-hidden /> : null}
              {f.label}
              <span className="text-muted-foreground/50" aria-hidden>·</span>
              <span className="tabular-nums text-muted-foreground">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Table + inspector. Desktop: table + persistent inspector. Narrow: full-width
          table with the inspector as a focused overlay for the selected employee. */}
      <div className={cn("grid min-h-0 flex-1", wide && "grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="min-h-0 overflow-y-auto">
          <ReviewTable
            rows={rows}
            loading={review.isLoading}
            selected={selected}
            revealed={revealed}
            onSelect={(n) => { setSelected(n); if (!wide) setInspectorOpen(true); }}
          />
        </div>
        {wide ? (
          <aside className="min-h-0 border-l border-border bg-card/40">
            <WorkforceReviewInspector row={selectedRow} baseline={session.baselineDate} sessionId={session.id} busy={busy} onDecide={applyDecision} />
          </aside>
        ) : inspectorOpen && selectedRow ? (
          <>
            <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]" onClick={() => setInspectorOpen(false)} aria-hidden />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-overlay">
              <button
                type="button"
                onClick={() => setInspectorOpen(false)}
                className="absolute right-3 top-3.5 z-10 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Close details"
              >
                <X className="size-4" aria-hidden />
              </button>
              <WorkforceReviewInspector row={selectedRow} baseline={session.baselineDate} sessionId={session.id} busy={busy} onDecide={applyDecision} />
            </aside>
          </>
        ) : null}
      </div>

      {/* Command region — stable; explains state or shows Ready summary. */}
      <div className="border-t border-border px-6 py-3">
        {error ? <p className="mb-2 type-meta text-[var(--color-destructive)]">{error}</p> : null}
        {hasBlockers && temporalGroup && issueGroups.length === 1 ? (
          // Temporal is the only work left — surface the one-click batch as the finishing action.
          <TemporalNormalizationRegion
            affected={temporalGroup.affectedPeople}
            baseline={session.baselineDate}
            onNormalize={() => applyDecision({ normalizeWorkDatesToBaseline: true })}
            onReview={() => { setFilter("NeedsAttention"); setPage(1); }}
            busy={busy}
          />
        ) : hasBlockers ? (
          <div className="flex items-center justify-between gap-4">
            <p className="type-body text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{openIssues}</span>{" "}
              {openIssues === 1 ? "decision" : "decisions"} left before you can import
            </p>
            <Button variant="outline" onClick={goToNextAttention} disabled={busy}>
              Next decision
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : counts.newCount === 0 ? (
          <ZeroWorkRegion counts={counts} onFinish={onFinishNoWork} finishing={committing} />
        ) : (
          <ReadyRegion counts={counts} onCommit={onCommit} committing={committing} />
        )}
      </div>
    </div>
  );
}

/**
 * Names the remaining work by its kind — "3 organizations to match · 40 people" — so the reviewer
 * sees a short, honest to-do (a few decisions) instead of a wall of "N need attention". Each kind is
 * a quiet affordance into the attention queue; genuine data errors read in the destructive tone.
 */
function ReviewBreakdown({ groups, onPick }: { groups: WorkforceReviewIssueGroupDto[]; onPick: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {groups.map((g) => {
        const d = describeGroup(g);
        return (
          <button
            key={g.category}
            type="button"
            onClick={onPick}
            className="flex items-center gap-1.5 type-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn("size-1.5 shrink-0 rounded-full", d.error ? "bg-[var(--color-destructive)]" : "bg-[var(--color-warning)]")}
              aria-hidden
            />
            <span className="font-medium text-foreground">{d.label}</span>
            {d.scope ? <span className="text-muted-foreground/80">· {d.scope}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ReviewTable({
  rows,
  loading,
  selected,
  revealed,
  onSelect,
}: {
  rows: WorkforceReviewRowDto[];
  loading: boolean;
  selected: number | null;
  revealed: Set<number>;
  onSelect: (n: number) => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2 px-6 py-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="grid h-full place-items-center type-meta text-muted-foreground">No employees in this view.</div>;
  }
  return (
    <table className="w-full border-collapse">
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="border-b border-border text-left type-meta uppercase tracking-wide text-muted-foreground">
          <th className="py-2 pl-6 pr-3 font-medium">Employee</th>
          <th className="hidden px-3 py-2 font-medium lg:table-cell">Employment</th>
          <th className="px-3 py-2 font-medium">Work</th>
          <th className="hidden px-3 py-2 font-medium lg:table-cell">Manager</th>
          <th className="py-2 pl-3 pr-6 text-right font-medium">Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const active = row.sourceRowNumber === selected;
          return (
            <tr
              key={row.sourceRowNumber}
              onClick={() => onSelect(row.sourceRowNumber)}
              className={cn(
                "cursor-pointer border-b border-border/60 align-middle transition-colors duration-[var(--duration-fast)]",
                active ? "bg-primary/[0.06]" : "hover:bg-muted/40",
                revealed.has(row.sourceRowNumber) && "animate-[pulse_0.7s_ease-in-out_1] bg-primary/[0.09]"
              )}
            >
              <td className={cn("relative py-2.5 pl-6 pr-3", active && "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary")}>
                <EmployeeIdentity
                  name={row.employee.displayName}
                  employeeNumber={row.employee.numberGenerated ? "Generated" : row.employee.employeeNumber}
                  size="sm"
                />
              </td>
              <td className="hidden px-3 py-2.5 type-meta text-muted-foreground tabular-nums lg:table-cell">
                {row.employment.startDate ? formatWorkforceDate(row.employment.startDate) : "—"}
              </td>
              <td className="min-w-0 px-3 py-2.5">
                <p className="truncate type-body text-foreground">{row.work.displayTitle ?? "—"}</p>
                {row.work.organization ? <p className="truncate type-meta text-muted-foreground">{row.work.organization}</p> : null}
              </td>
              <td className="hidden max-w-[12rem] px-3 py-2.5 type-meta lg:table-cell">
                {row.manager.state === "NoManager" ? (
                  <span className="text-muted-foreground">No manager</span>
                ) : row.manager.state === "Unresolved" ? (
                  <span className="block truncate text-[var(--color-warning)]">{row.manager.display ?? "Unresolved"}</span>
                ) : (
                  // One truncating line, so "Name · also being added" clips as a whole rather than
                  // breaking into a second cut-off row.
                  <span className="block truncate text-foreground">
                    {row.manager.display ?? "—"}
                    {row.manager.subtext ? <span className="text-muted-foreground"> · {row.manager.subtext.toLowerCase()}</span> : null}
                  </span>
                )}
              </td>
              <td className="py-2.5 pl-3 pr-6 text-right">
                <StatusBadge tone={RESULT_TONE[row.result]} dot={row.result === "NeedsAttention" || row.result === "New"}>
                  {RESULT_LABEL[row.result]}
                </StatusBadge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * A business-migration decision, not a validation dump: current work details dated before the
 * Organization existed in Fusion. One explicit choice establishes the whole affected cohort's current
 * work (and initial manager) at the conversion baseline; the raw affected rows stay one click away.
 */
function TemporalNormalizationRegion({
  affected,
  baseline,
  onNormalize,
  onReview,
  busy,
}: {
  affected: number;
  baseline: string;
  onNormalize: () => void;
  onReview: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[var(--color-warning-subtle)] px-4 py-3 ring-1 ring-inset ring-[var(--color-warning)]/25">
      <div className="min-w-0">
        <p className="type-label font-semibold text-foreground">
          Current work dates predate the Organization history available in Fusion
        </p>
        <p className="mt-0.5 type-meta text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{affected}</span>{" "}
          {affected === 1 ? "person has" : "people have"} current work details dated before their Organization existed in Fusion.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onReview} disabled={busy} className="text-muted-foreground">
          Review affected people
        </Button>
        <Button onClick={onNormalize} disabled={busy}>
          {busy ? "Applying…" : `Establish as of ${formatWorkforceDate(baseline)}`}
        </Button>
      </div>
    </div>
  );
}

function ZeroWorkRegion({
  counts,
  onFinish,
  finishing,
}: {
  counts: WorkforceImportSessionDto["counts"];
  onFinish: () => void;
  finishing: boolean;
}) {
  const title = counts.existingAnchorCount > 0 ? "Nothing new to add" : "Nothing to import";
  const detail =
    counts.existingAnchorCount > 0
      ? `Every employee in this file is already in Fusion${counts.excludedCount > 0 ? ` · ${counts.excludedCount} excluded` : ""}.`
      : "No new employees will be added from this file.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="type-label font-semibold text-foreground">{title}</p>
        <p className="type-meta text-muted-foreground">{detail}</p>
      </div>
      <Button variant="outline" onClick={onFinish} disabled={finishing}>
        {finishing ? "Finishing…" : "Finish"}
      </Button>
    </div>
  );
}

function ReadyRegion({
  counts,
  onCommit,
  committing,
}: {
  counts: WorkforceImportSessionDto["counts"];
  onCommit: () => void;
  committing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary/[0.05] px-4 py-2.5 ring-1 ring-inset ring-primary/15">
      <div>
        <p className="type-label font-semibold text-foreground">Ready to import</p>
        <p className="type-meta text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{counts.newCount}</span>{" "}
          {counts.newCount === 1 ? "employee" : "employees"} will be added
          {counts.existingAnchorCount > 0 ? <> · existing employees stay unchanged</> : null}
          {counts.excludedCount > 0 ? <> · {counts.excludedCount} excluded</> : null}
        </p>
      </div>
      <Button onClick={onCommit} disabled={committing}>
        {committing ? "Preparing import…" : "Complete import"}
      </Button>
    </div>
  );
}
