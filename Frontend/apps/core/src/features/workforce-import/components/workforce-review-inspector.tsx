"use client";

import { useMemo, useState } from "react";
import { Button, Input, cn } from "@repo/ds";
import { StatusBadge } from "@repo/ds/shell";
import { Building2, Check, Search, UsersRound } from "lucide-react";
import type {
  OrganizationHierarchyNodeDto,
  WorkforceDecisionRequest,
  WorkforceReviewIssueDto,
  WorkforceReviewRowDto,
} from "@repo/api";
import { useOrganizationHierarchy } from "@/features/organization/api/use-organization";
import { usePeople } from "@/features/people/api/use-people";
import { EmployeeIdentity, Monogram, formatWorkforceDate } from "@/features/people/components/workforce-ui";
import { useImportManagerCandidates } from "../api/use-workforce-import";

type Decide = (decision: WorkforceDecisionRequest) => void;

const ORG_CODES = new Set(["OrganizationUnresolved", "OrganizationInvalidToday", "OrganizationMissing"]);
const MANAGER_CODES = new Set(["ManagerUnresolved", "SelfManager", "ManagerCycle"]);
const DIFFERENCE_CODES = new Set(["UnsupportedExistingDifference"]);
const LIFECYCLE_CODES = new Set(["FormerWorkerNotEstablished", "EmploymentEndedBeforeToday", "EmploymentStartAfterBaseline"]);
const WORKDATE_CODES = new Set(["WorkDatePrecedesOrganizationHistory"]);

/**
 * The contextual inspector. It shows one active meaning for the selected row and its resolution —
 * never a grid of equal cards, never an empty rail. The most important human facts scan first.
 */
export function WorkforceReviewInspector({
  row,
  baseline,
  sessionId,
  busy,
  onDecide,
}: {
  row: WorkforceReviewRowDto | null;
  baseline: string;
  sessionId: string;
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

  const blocker = row.issues.find((i) => i.severity === "blocker");

  return (
    <div className="flex h-full flex-col">
      <InspectorHeader row={row} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {row.result === "Excluded" ? (
          <ExcludedPanel row={row} busy={busy} onDecide={onDecide} />
        ) : blocker && ORG_CODES.has(blocker.code) ? (
          <OrganizationResolution row={row} issue={blocker} baseline={baseline} busy={busy} onDecide={onDecide} />
        ) : blocker && MANAGER_CODES.has(blocker.code) ? (
          <ManagerResolution row={row} issue={blocker} sessionId={sessionId} busy={busy} onDecide={onDecide} />
        ) : blocker && DIFFERENCE_CODES.has(blocker.code) ? (
          <ExistingDifference row={row} busy={busy} onDecide={onDecide} />
        ) : blocker && LIFECYCLE_CODES.has(blocker.code) ? (
          <LifecycleGuard row={row} issue={blocker} busy={busy} onDecide={onDecide} />
        ) : blocker && WORKDATE_CODES.has(blocker.code) ? (
          <WorkDateResolution row={row} issue={blocker} baseline={baseline} busy={busy} onDecide={onDecide} />
        ) : blocker ? (
          <GenericBlocker row={row} issue={blocker} busy={busy} onDecide={onDecide} />
        ) : row.result === "Existing" ? (
          <ExistingAnchor row={row} />
        ) : (
          <ReadyEmployee row={row} />
        )}
      </div>
    </div>
  );
}

function InspectorHeader({ row }: { row: WorkforceReviewRowDto }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4">
      <Monogram name={row.employee.displayName} size="lg" accent={row.result === "New"} />
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

function ReadyEmployee({ row }: { row: WorkforceReviewRowDto }) {
  return (
    <div className="space-y-5">
      <Field label="Employment">
        {row.employment.startDate ? `Started ${formatWorkforceDate(row.employment.startDate)}` : "—"}
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
            {row.manager.subtext ? <span className="ml-1.5 type-meta text-muted-foreground">· {row.manager.subtext}</span> : null}
          </span>
        )}
      </Field>
      <div className="flex items-center gap-2 pt-1 type-label font-medium text-[var(--color-success)]">
        <Check className="size-4" aria-hidden /> Ready to add
      </div>
    </div>
  );
}

function ExistingAnchor({ row }: { row: WorkforceReviewRowDto }) {
  return (
    <div className="space-y-4">
      <StatusBadge tone="muted" dot>Already in Fusion</StatusBadge>
      <Field label="Current work">
        <p className="font-medium">{row.work.displayTitle ?? "—"}</p>
        {row.work.organization ? <p className="text-muted-foreground">{row.work.organization}</p> : null}
      </Field>
      <p className="type-meta text-muted-foreground">
        This employee already exists in Fusion. Workforce Import doesn&apos;t change existing records.
      </p>
    </div>
  );
}

function AttentionHeading({ issue }: { issue: WorkforceReviewIssueDto }) {
  return (
    <div className="mb-4">
      <StatusBadge tone="warning" dot>Needs attention</StatusBadge>
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
  const { data: hierarchy } = useOrganizationHierarchy(baseline);
  const [search, setSearch] = useState("");
  const units = useMemo(() => flattenUnits(hierarchy?.roots ?? []), [hierarchy]);
  const sourceValue = row.work.organization ?? "";
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
        {rest.length === 0 ? <li className="px-2.5 py-2 type-meta text-muted-foreground">No matching organization.</li> : null}
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
  const reference = row.manager.display ?? "";
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

function ExistingDifference({
  row,
  busy,
  onDecide,
}: {
  row: WorkforceReviewRowDto;
  busy: boolean;
  onDecide: Decide;
}) {
  return (
    <div>
      <div className="mb-4">
        <StatusBadge tone="muted" dot>Already in Fusion</StatusBadge>
      </div>
      <div className="space-y-3">
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="type-meta text-muted-foreground">Your file says</p>
          <p className="type-label font-medium text-foreground">{row.work.displayTitle ?? row.work.organization ?? "—"}</p>
        </div>
      </div>
      <p className="mt-4 type-meta text-muted-foreground">
        Workforce Import doesn&apos;t change existing employee records.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Button size="sm" disabled={busy} onClick={() => onDecide({ keepFusionUnchangedRow: row.sourceRowNumber })}>
          Keep Fusion unchanged
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} className="text-muted-foreground" onClick={() => onDecide({ excludeRow: row.sourceRowNumber })}>
          Exclude row
        </Button>
      </div>
    </div>
  );
}

/**
 * Current work dates predate the Organization's Fusion history. The resolution is a business decision,
 * not an exclusion: establish this cohort's current work (and initial manager) at the baseline. The
 * action is the same grouped normalization the footer offers, so the inspector never contradicts it.
 */
function WorkDateResolution({
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
  return (
    <div>
      <AttentionHeading issue={issue} />
      {issue.affectedCount > 1 ? (
        <p className="flex items-center gap-1.5 type-meta text-muted-foreground">
          <UsersRound className="size-3.5" aria-hidden />
          <span className="font-semibold text-foreground tabular-nums">{issue.affectedCount}</span> people have work dated
          before their Organization existed in Fusion.
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        <Button size="sm" disabled={busy} onClick={() => onDecide({ normalizeWorkDatesToBaseline: true })}>
          Establish as of {formatWorkforceDate(baseline)}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} className="text-muted-foreground" onClick={() => onDecide({ excludeRow: row.sourceRowNumber })}>
          Exclude row
        </Button>
      </div>
      {issue.affectedCount > 1 ? (
        <p className="mt-3 type-meta text-muted-foreground">Establishing applies to all {issue.affectedCount} people.</p>
      ) : null}
    </div>
  );
}

function LifecycleGuard({
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
      <div className="mt-4">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide({ excludeRow: row.sourceRowNumber })}>
          Exclude row
        </Button>
      </div>
    </div>
  );
}

function GenericBlocker({
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
  const fixInFile = ["EmploymentStartMissing", "NameMissing", "DisplayTitleMissing", "DateUnparseable"].includes(issue.code);
  return (
    <div>
      <AttentionHeading issue={issue} />
      {fixInFile ? (
        <p className="type-meta text-muted-foreground">
          Correct this value in your source file, then replace the file from Source details.
        </p>
      ) : null}
      <div className="mt-4">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide({ excludeRow: row.sourceRowNumber })}>
          Exclude row
        </Button>
      </div>
    </div>
  );
}

function ExcludedPanel({ row, busy, onDecide }: { row: WorkforceReviewRowDto; busy: boolean; onDecide: Decide }) {
  return (
    <div className="space-y-4">
      <StatusBadge tone="muted">Excluded from this import</StatusBadge>
      <p className="type-meta text-muted-foreground">This row will not be added.</p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide({ includeRow: row.sourceRowNumber })}>
        Include again
      </Button>
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
