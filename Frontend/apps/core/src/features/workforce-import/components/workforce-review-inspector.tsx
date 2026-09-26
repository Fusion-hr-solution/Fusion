"use client";

import { useMemo, useState } from "react";
import { Button, Input, Skeleton, cn } from "@repo/ds";
import { StatusBadge } from "@repo/ds/shell";
import { Building2, Check, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import type {
  OrganizationHierarchyNodeDto,
  WorkforceResolutionsUpdateRequest,
  WorkforceReviewIssueDto,
  WorkforceReviewRowDto,
} from "@repo/api";
import { useOrganizationHierarchy } from "@/features/organization/api/use-organization";
import { usePeople } from "@/features/people/api/use-people";
import { EmployeeIdentity, Monogram, formatWorkforceDate } from "@/features/people/components/workforce-ui";
import { useImportManagerCandidates } from "../api/use-workforce-import";
import { employmentState } from "../model/review-view";

type Decide = (resolution: WorkforceResolutionsUpdateRequest) => void;

/**
 * The contextual inspector. It shows one active meaning for the selected row and its resolution —
 * never a grid of equal cards, never an empty rail. The most important human facts scan first.
 */
export function WorkforceReviewInspector({
  row,
  baseline,
  sessionId,
  matchHref,
  busy,
  onDecide,
}: {
  row: WorkforceReviewRowDto | null;
  baseline: string;
  sessionId: string;
  matchHref: string;
  busy: boolean;
  onDecide: Decide;
}) {
  if (!row) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <p className="type-meta text-muted-foreground">Select an employee to see details.</p>
      </div>
    );
  }

  // The first blocker decides the panel; what it offers comes from the issue's own resolution
  // pathways, so Review can only ever answer an issue, never edit the proposed person.
  const blocker = row.issues.find((i) => i.severity === "Blocker");
  const offers = (kind: WorkforceReviewIssueDto["resolutions"][number]) => blocker?.resolutions.includes(kind) ?? false;

  return (
    <div className="flex h-full flex-col">
      <InspectorHeader row={row} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {blocker && offers("ChooseOrgUnit") ? (
          <OrganizationResolution row={row} issue={blocker} baseline={baseline} busy={busy} onDecide={onDecide} />
        ) : blocker && offers("ChooseManager") ? (
          <ManagerResolution row={row} issue={blocker} sessionId={sessionId} busy={busy} onDecide={onDecide} />
        ) : blocker && offers("UseBaselineForWorkDates") ? (
          <WorkDateResolution issue={blocker} baseline={baseline} busy={busy} onDecide={onDecide} />
        ) : blocker && offers("KeepDistinct") ? (
          <DuplicateResolution row={row} issue={blocker} busy={busy} onDecide={onDecide} />
        ) : blocker ? (
          <SourceBlocker issue={blocker} matchHref={offers("ReturnToMatch") ? matchHref : null} />
        ) : row.classification === "NotImported" ? (
          <NotImported row={row} baseline={baseline} />
        ) : row.classification === "Existing" ? (
          <ExistingAnchor row={row} />
        ) : (
          <ReadyEmployee row={row} baseline={baseline} />
        )}
      </div>
    </div>
  );
}

function InspectorHeader({ row }: { row: WorkforceReviewRowDto }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-4 pl-5 pr-12">
      <Monogram name={row.employee.displayName} size="lg" accent={row.classification === "Create"} />
      <div className="min-w-0">
        <p className="truncate type-title font-semibold text-foreground">{row.employee.displayName}</p>
        <p className="type-code text-xs text-muted-foreground">
          {row.employee.numberGenerated ? "Number generated" : row.employee.employeeNumber ?? "—"}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-meta uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 type-body text-foreground">{children}</div>
    </div>
  );
}

/** The person as Fusion will establish them. */
function Details({ row, baseline }: { row: WorkforceReviewRowDto; baseline: string }) {
  const employment = employmentState(row, baseline);
  return (
    <>
      <Field label="Employment">
        {employment.date ? `${employment.label} ${formatWorkforceDate(employment.date)}` : employment.label}
      </Field>
      <Field label="Current work">
        <p className="font-medium">{row.work.displayTitle ?? "—"}</p>
        {row.work.organization ? <p className="text-muted-foreground">{row.work.organization}</p> : null}
        {row.work.location ? <p className="type-meta text-muted-foreground">{row.work.location}</p> : null}
        {row.work.effectiveFrom ? (
          <p className="mt-1 type-meta text-muted-foreground">Effective from {formatWorkforceDate(row.work.effectiveFrom)}</p>
        ) : null}
      </Field>
      <Field label="Manager">
        {row.manager.state === "NoManager" ? (
          <span className="text-muted-foreground">No manager</span>
        ) : (
          <span>
            {row.manager.display ?? "—"}
            {row.manager.employeeNumber ? <span className="ml-1.5 type-meta text-muted-foreground">{row.manager.employeeNumber}</span> : null}
            {row.manager.subtext ? <span className="block type-meta text-muted-foreground">{row.manager.subtext}</span> : null}
          </span>
        )}
      </Field>
      {row.employee.workEmail ? <Field label="Work email">{row.employee.workEmail}</Field> : null}
    </>
  );
}

function ReadyEmployee({ row, baseline }: { row: WorkforceReviewRowDto; baseline: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 type-label font-medium text-success">
        <Check className="size-4" aria-hidden /> Will be created
      </div>
      <Details row={row} baseline={baseline} />
      <Notices row={row} />
    </div>
  );
}

/** Warnings: Fusion can publish, but these deserve a look. */
function Notices({ row }: { row: WorkforceReviewRowDto }) {
  const warnings = row.issues.filter((i) => i.severity === "Warning");
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-2">
      {warnings.map((w) => (
        <li key={w.code} className="rounded-md bg-[var(--color-warning-subtle)] px-3 py-2">
          <p className="type-label font-medium text-foreground">{w.title}</p>
          <p className="type-meta text-muted-foreground">{w.message}</p>
        </li>
      ))}
    </ul>
  );
}

function NotImported({ row, baseline }: { row: WorkforceReviewRowDto; baseline: string }) {
  return (
    <div className="space-y-5">
      <StatusBadge tone="neutral">Not imported</StatusBadge>
      <Notices row={row} />
      <Details row={row} baseline={baseline} />
    </div>
  );
}

function ExistingAnchor({ row }: { row: WorkforceReviewRowDto }) {
  return (
    <div className="space-y-4">
      <StatusBadge tone="muted" dot>Already in Fusion · no changes</StatusBadge>
      <Field label="In Fusion">
        <p className="font-medium">{row.employee.existingEmployeeName ?? row.employee.displayName}</p>
        {row.work.organization ? <p className="text-muted-foreground">{row.work.organization}</p> : null}
      </Field>
      <Notices row={row} />
    </div>
  );
}

function AttentionHeading({ issue }: { issue: WorkforceReviewIssueDto }) {
  return (
    <div className="mb-4">
      <StatusBadge tone="warning" dot>{issue.title}</StatusBadge>
      <p className="mt-2 type-label font-medium text-foreground">{issue.message}</p>
    </div>
  );
}

function OrganizationResolution({
  row,
  issue,
  baseline,
  busy,
  onDecide,
}: {
  row: WorkforceReviewRowDto;
  issue: WorkforceReviewIssueDto;
  baseline: string;
  busy: boolean;
  onDecide: Decide;
}) {
  const { data: hierarchy, isLoading: loadingUnits } = useOrganizationHierarchy(baseline);
  const [search, setSearch] = useState("");
  const units = useMemo(() => flattenUnits(hierarchy?.roots ?? []), [hierarchy]);
  const sourceValue = row.work.sourceOrganization ?? "";
  const q = fold(search.trim());

  // Likely answers first: candidates that resemble the source value (accent/case-insensitive),
  // as review evidence — never an auto-choice. The rest stay reachable under "All organizations".
  const suggested = useMemo(() => {
    if (q) return [];
    return units
      .map((u) => ({ u, score: relevance(fold(sourceValue), u) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.u.name.localeCompare(b.u.name))
      .slice(0, 3)
      .map(({ u }) => u);
  }, [units, sourceValue, q]);
  const rest = useMemo(() => {
    const suggestedIds = new Set(suggested.map((u) => u.id));
    const ranked = units
      .map((u) => ({ u, score: q ? matchScore(q, u) : 0 }))
      .filter(({ u, score }) => (q ? score > 0 : !suggestedIds.has(u.id)))
      .sort((a, b) => b.score - a.score || a.u.name.localeCompare(b.u.name))
      .map(({ u }) => u);
    return ranked.slice(0, 40);
  }, [units, q, suggested]);

  const pick = (u: FlatUnit) => onDecide({ organizationSourceValue: sourceValue, organizationUnitId: u.id });

  return (
    <div>
      <AttentionHeading issue={issue} />
      <div className="rounded-md bg-muted/40 px-3 py-2">
        <p className="type-meta text-muted-foreground">Your file</p>
        <p className="type-label font-medium text-foreground">{sourceValue || "—"}</p>
      </div>

      {issue.affectedCount > 1 ? (
        <p className="mt-3 flex items-center gap-1.5 type-meta text-muted-foreground">
          <UsersRound className="size-3.5" aria-hidden />
          <span className="font-medium text-foreground">&quot;{sourceValue}&quot;</span> appears on{" "}
          <span className="font-semibold text-foreground tabular-nums">{issue.affectedCount}</span> employees
        </p>
      ) : null}

      {suggested.length > 0 ? (
        <div className="mt-4">
          <p className="type-meta uppercase tracking-wide text-muted-foreground">Suggested matches</p>
          <ul className="mt-2 space-y-1">
            {suggested.map((u) => (
              <li key={u.id}>
                <UnitButton unit={u} busy={busy} onClick={() => pick(u)} suggested />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 type-meta uppercase tracking-wide text-muted-foreground">
        {suggested.length > 0 ? "All organizations" : "Which Organization does it mean?"}
      </p>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organization…" className="h-8 pl-8 type-meta" />
      </div>
      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {rest.map((u) => (
          <li key={u.id}>
            <UnitButton unit={u} busy={busy} onClick={() => pick(u)} />
          </li>
        ))}
        {loadingUnits
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-11 w-full rounded-md" />
              </li>
            ))
          : rest.length === 0
            ? <li className="px-2.5 py-2 type-meta text-muted-foreground">No matching organization.</li>
            : null}
      </ul>
      {issue.affectedCount > 1 ? (
        <p className="mt-3 type-meta text-muted-foreground">Choosing applies to all {issue.affectedCount} employees.</p>
      ) : null}
    </div>
  );
}

function UnitButton({ unit, busy, onClick, suggested }: { unit: FlatUnit; busy: boolean; onClick: () => void; suggested?: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left disabled:opacity-50",
        suggested ? "bg-primary/[0.04] ring-1 ring-inset ring-primary/15 hover:bg-primary/[0.08]" : "hover:bg-muted/60"
      )}
    >
      <Building2 className={cn("size-4 shrink-0", suggested ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0">
        <span className="block truncate type-label font-medium text-foreground">{unit.name}</span>
        {unit.ancestry ? <span className="block truncate type-meta text-muted-foreground">{unit.ancestry}</span> : null}
      </span>
    </button>
  );
}

/**
 * Resolve an unresolved manager reference. In an establishment import the manager is usually another
 * person in the same file, so this searches the import cohort first (likely matches surfaced from the
 * reference) and existing Fusion employees second. The choice is scoped to the *reference*, so one pick
 * resolves everyone reporting to that manager — never one row at a time.
 */
function ManagerResolution({
  row,
  issue,
  sessionId,
  busy,
  onDecide,
}: {
  row: WorkforceReviewRowDto;
  issue: WorkforceReviewIssueDto;
  sessionId: string;
  busy: boolean;
  onDecide: Decide;
}) {
  const [search, setSearch] = useState("");
  // The grouped decision key names the reference; the display is what the file said.
  const reference = issue.decisionKey?.startsWith("mgr:") ? issue.decisionKey.slice(4) : row.manager.display ?? "";
  const cohort = useImportManagerCandidates(sessionId, reference, search.trim());
  const { data: peopleData } = usePeople({ q: search.trim() || null, page: 1, pageSize: 5 });

  const importCandidates = (cohort.data ?? []).filter((c) => c.sourceRowNumber !== row.sourceRowNumber).slice(0, 5);
  const existing = (peopleData?.items ?? []).slice(0, 5);
  const empty = importCandidates.length === 0 && existing.length === 0;

  const pickImport = (rowNumber: number) => onDecide({ managerReference: reference, managerImportRowNumber: rowNumber });
  const pickExisting = (employeeKey: string) => onDecide({ managerReference: reference, managerEmployeeKey: employeeKey });
  const clearManager = () => onDecide({ managerReference: reference, noManager: true });

  return (
    <div>
      <AttentionHeading issue={issue} />
      {reference ? (
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="type-meta text-muted-foreground">Your file</p>
          <p className="type-label font-medium text-foreground">{reference}</p>
        </div>
      ) : null}

      {issue.affectedCount > 1 ? (
        <p className="mt-3 flex items-center gap-1.5 type-meta text-muted-foreground">
          <UsersRound className="size-3.5" aria-hidden />
          <span className="font-medium text-foreground">&quot;{reference}&quot;</span> manages{" "}
          <span className="font-semibold text-foreground tabular-nums">{issue.affectedCount}</span> people in this import
        </p>
      ) : null}

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-8 pl-8 type-meta" />
      </div>

      {importCandidates.length > 0 ? (
        <div className="mt-4">
          <p className="type-meta uppercase tracking-wide text-muted-foreground">In this import</p>
          <ul className="mt-2 space-y-1">
            {importCandidates.map((c) => (
              <li key={c.sourceRowNumber}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pickImport(c.sourceRowNumber)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60 disabled:opacity-50"
                >
                  <EmployeeIdentity
                    name={c.displayName}
                    employeeNumber={c.numberGenerated ? "Generated" : c.employeeNumber}
                    secondary={c.title ?? undefined}
                    size="sm"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {existing.length > 0 ? (
        <div className="mt-4">
          <p className="type-meta uppercase tracking-wide text-muted-foreground">Already in Fusion</p>
          <ul className="mt-2 space-y-1">
            {existing.map((person) => (
              <li key={person.employeeKey}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pickExisting(person.employeeKey)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60 disabled:opacity-50"
                >
                  <EmployeeIdentity
                    name={person.displayName}
                    employeeNumber={person.employeeNumber}
                    secondary={[person.work?.jobTitle, person.work?.organizationName].filter(Boolean).join(" · ") || undefined}
                    size="sm"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 type-meta text-muted-foreground">
        {empty && search ? "No one matches — " : "Or "}
        <button
          type="button"
          disabled={busy}
          onClick={clearManager}
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          set no manager
        </button>
      </p>
    </div>
  );
}

/**
 * A work start date the file gives is missing or out of range. The one bounded answer is to use the
 * workforce-as-of date for these people; anything else is a correction in the file.
 */
function WorkDateResolution({
  issue,
  baseline,
  busy,
  onDecide,
}: {
  issue: WorkforceReviewIssueDto;
  baseline: string;
  busy: boolean;
  onDecide: Decide;
}) {
  return (
    <div>
      <AttentionHeading issue={issue} />
      <Button size="sm" disabled={busy} onClick={() => onDecide({ useBaselineForWorkDates: true })}>
        Use {formatWorkforceDate(baseline)} as their work start
      </Button>
    </div>
  );
}

function DuplicateResolution({
  row,
  issue,
  busy,
  onDecide,
}: {
  row: WorkforceReviewRowDto;
  issue: WorkforceReviewIssueDto;
  busy: boolean;
  onDecide: Decide;
}) {
  return (
    <div>
      <AttentionHeading issue={issue} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide({ keepAsDistinctRow: row.sourceRowNumber })}>
        They&apos;re different people
      </Button>
    </div>
  );
}

/** Blockers only the source can fix, or that belong to Match. */
function SourceBlocker({ issue, matchHref }: { issue: WorkforceReviewIssueDto; matchHref: string | null }) {
  return (
    <div>
      <AttentionHeading issue={issue} />
      {matchHref ? (
        <Button size="sm" variant="outline" asChild>
          <Link href={matchHref}>Change matching</Link>
        </Button>
      ) : (
        <p className="type-meta text-muted-foreground">Fix this in your file, then start a new import with it.</p>
      )}
    </div>
  );
}

/** Accent- and case-fold for tolerant matching ("Opérations" ≈ "operations"). */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Relevance of a unit to the source value when nothing has been typed yet. */
function relevance(source: string, unit: FlatUnit): number {
  if (!source) return 0;
  const name = fold(unit.name);
  if (name === source) return 100;
  if (name.startsWith(source) || source.startsWith(name)) return 80;
  const tokens = source.split(/[\s/&,-]+/).filter((t) => t.length > 2);
  let score = 0;
  for (const t of tokens) {
    if (name.includes(t)) score = Math.max(score, 60);
    else if (fold(unit.path).includes(t)) score = Math.max(score, 30);
  }
  return score;
}

/** Score a unit against a typed query. */
function matchScore(q: string, unit: FlatUnit): number {
  const name = fold(unit.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (fold(unit.path).includes(q)) return 30;
  return 0;
}

interface FlatUnit {
  id: string;
  name: string;
  path: string;
  ancestry: string;
}

function flattenUnits(roots: OrganizationHierarchyNodeDto[]): FlatUnit[] {
  const out: FlatUnit[] = [];
  const walk = (nodes: OrganizationHierarchyNodeDto[]) => {
    for (const node of nodes) {
      const segments = node.unit.path.split("/").map((s) => s.trim()).filter(Boolean);
      out.push({
        id: node.unit.id,
        name: node.unit.name,
        path: node.unit.path,
        ancestry: segments.slice(0, -1).join(" / "),
      });
      walk(node.children);
    }
  };
  walk(roots);
  return out;
}
