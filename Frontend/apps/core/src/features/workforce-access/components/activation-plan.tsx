"use client";

import { useId, useMemo, useState } from "react";
import type {
  WorkforceAccessBulkResultItemDto,
  WorkforceAccessCandidateDto,
  WorkforceAccessSubjectSummaryDto,
  WorkforceBaselineChoice,
} from "@repo/api";
import { Button, Input, Label, Skeleton, Spinner, cn } from "@repo/ds";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { PersonIdentity } from "@/features/people/components/workforce-ui";
import {
  useAccessCandidates,
  useBulkActivate,
  useUpdateWorkforceWorkEmail,
} from "../api/use-workforce-access";
import { peopleProfilePath } from "./workforce-access-navigation";

type Phase = "plan" | "running" | "receipt";
type GroupKind = "attention" | "consequence" | "routine" | "unchanged";

interface PlanPerson {
  subject: WorkforceAccessSubjectSummaryDto;
  candidate: WorkforceAccessCandidateDto | null;
}

interface PlanGroup {
  key: string;
  title: string;
  hint: string;
  actionable: boolean;
  kind: GroupKind;
  showAccountComparison?: boolean;
  people: PlanPerson[];
}

export interface ActivationPlanCounts {
  invitations: number;
  links: number;
  reactivations: number;
  connections: number;
  pending: number;
  alreadyActive: number;
  attention: number;
}

export interface OperationalReceiptItem extends WorkforceAccessBulkResultItemDto {
  email: string | null;
}

export interface OperationalReceipt {
  items: OperationalReceiptItem[];
}

export function ActivationPlan({
  people,
  onBack,
  onExit,
}: {
  people: WorkforceAccessSubjectSummaryDto[];
  onBack: () => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("plan");
  const [baselines, setBaselines] = useState<
    Record<string, WorkforceBaselineChoice>
  >(() =>
    Object.fromEntries(
      people.map((person) => [
        person.employeeId,
        person.directReportCount > 0 ? "Manager" : "Employee",
      ])
    )
  );
  const [receipt, setReceipt] = useState<OperationalReceipt | null>(null);
  const [runError, setRunError] = useState(false);
  const bulk = useBulkActivate();
  const employeeIds = useMemo(
    () => people.map((person) => person.employeeId),
    [people]
  );
  const candidates = useAccessCandidates(employeeIds);
  const [recheckingEmployeeId, setRecheckingEmployeeId] = useState<
    string | null
  >(null);

  const groups = useMemo<PlanGroup[]>(() => {
    if (!candidates.data) return [];

    const byEmployee = new Map(
      candidates.data.map((candidate) => [candidate.employeeId, candidate])
    );
    const resolved: PlanPerson[] = people.map((subject) => ({
      subject,
      candidate: byEmployee.get(subject.employeeId) ?? null,
    }));
    const pending = (person: PlanPerson) =>
      person.subject.accessState === "InvitePending";
    const byCandidate = (state: WorkforceAccessCandidateDto["accountState"]) =>
      resolved.filter(
        (person) => !pending(person) && person.candidate?.accountState === state
      );
    const blockedPeople = resolved.filter(
      (person) =>
        !pending(person) &&
        (person.candidate === null ||
          (person.candidate.accountState === "NewAccount" &&
            !person.candidate.workEmail) ||
          person.candidate.accountState === "BindingConflict" ||
          person.candidate.accountState === "AccountUnavailable")
    );

    const groupList: PlanGroup[] = [
      {
        key: "blocked",
        title: "Needs review",
        hint:
          blockedPeople.length === 1
            ? "This person will not be changed."
            : "These people will not be changed.",
        actionable: false,
        kind: "attention",
        people: blockedPeople,
      },
      {
        key: "link",
        title: "Existing accounts will be linked",
        hint: "Review each identity match. Existing access stays in place.",
        actionable: true,
        kind: "consequence",
        showAccountComparison: true,
        people: byCandidate("ExistingAccountReadyToLink"),
      },
      {
        key: "reactivate",
        title: "Suspended accounts will be reactivated",
        hint: "Tenant access returns and the employee record is linked.",
        actionable: true,
        kind: "consequence",
        showAccountComparison: true,
        people: byCandidate("SuspendedAccountReadyToReactivate"),
      },
      {
        key: "connect",
        title: "Existing Fusion accounts will join this workspace",
        hint: "Review each account before this workspace is added.",
        actionable: true,
        kind: "consequence",
        showAccountComparison: true,
        people: byCandidate("ExistingAccountReadyToJoinTenant"),
      },
      {
        key: "new",
        title: "New invitations",
        hint: "One invitation will be sent to each canonical work email.",
        actionable: true,
        kind: "routine",
        people: byCandidate("NewAccount").filter(
          (person) => !!person.candidate?.workEmail
        ),
      },
      {
        key: "pending",
        title: "Invitations already pending",
        hint: "No new invitation will be sent.",
        actionable: false,
        kind: "unchanged",
        people: resolved.filter(pending),
      },
      {
        key: "active",
        title: "Already active",
        hint: "These people already have workforce access.",
        actionable: false,
        kind: "unchanged",
        people: byCandidate("Active"),
      },
    ];

    return groupList.filter((group) => group.people.length > 0);
  }, [candidates.data, people]);

  const actionablePeople = useMemo(
    () =>
      groups
        .filter((group) => group.actionable)
        .flatMap((group) => group.people),
    [groups]
  );
  const counts = useMemo(() => planCounts(groups), [groups]);

  const run = async () => {
    setRunError(false);
    setPhase("running");
    try {
      const result = await bulk.mutateAsync({
        items: actionablePeople.map(({ subject }) => ({
          employeeId: subject.employeeId,
          baseline: baselines[subject.employeeId] ?? "Employee",
        })),
      });
      setReceipt(
        buildOperationalReceipt(people, candidates.data ?? [], result.items)
      );
      setPhase("receipt");
    } catch {
      setRunError(true);
      setPhase("plan");
    }
  };

  const recheckEmployee = async (employeeId: string) => {
    setRecheckingEmployeeId(employeeId);
    try {
      await candidates.refetch();
    } finally {
      setRecheckingEmployeeId(null);
    }
  };

  if (phase === "receipt" && receipt) {
    return <Receipt receipt={receipt} onExit={onExit} />;
  }

  if (candidates.isLoading) {
    return (
      <ActivationPlanLoading peopleCount={people.length} onBack={onBack} />
    );
  }

  if (candidates.error) {
    return (
      <div className="border-l-2 border-danger bg-danger/5 px-5 py-4">
        <p className="type-label">The activation plan could not be prepared</p>
        <p className="mt-1 type-meta text-muted-foreground">
          Account state may have changed. Return to the workforce and try again.
        </p>
        <Button className="mt-4" variant="outline" onClick={onBack}>
          Back to workforce access
        </Button>
      </div>
    );
  }

  const running = phase === "running";

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={running}>
          <ArrowLeft className="mr-1.5 size-4" /> Back to selection
        </Button>
        <p className="type-body text-muted-foreground">
          <span className="type-metric mr-2 text-foreground">
            {people.length}
          </span>
          {people.length === 1 ? "person reviewed" : "people reviewed"}
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          {groups.map((group) => (
            <PlanSection
              key={group.key}
              group={group}
              baselines={baselines}
              running={running}
              onBaseline={(employeeId, choice) =>
                setBaselines((current) => ({
                  ...current,
                  [employeeId]: choice,
                }))
              }
              recheckingEmployeeId={recheckingEmployeeId}
              onEmailSaved={recheckEmployee}
            />
          ))}
        </div>

        <DecisionSummary
          counts={counts}
          actionableCount={actionablePeople.length}
          running={running}
          runError={runError}
          onRun={() => void run()}
        />
      </div>
    </div>
  );
}

function ActivationPlanLoading({
  peopleCount,
  onBack,
}: {
  peopleCount: number;
  onBack: () => void;
}) {
  return (
    <div className="space-y-7" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-4" /> Back to selection
        </Button>
        <p className="type-body text-muted-foreground">
          <span className="type-metric mr-2 text-foreground">
            {peopleCount}
          </span>
          {peopleCount === 1 ? "person selected" : "people selected"}
        </p>
      </div>

      <section
        className="border-y py-6 sm:py-7"
        aria-labelledby="activation-plan-loading-title"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="type-eyebrow text-muted-foreground">
              Activation plan
            </p>
            <h2
              id="activation-plan-loading-title"
              className="mt-2 type-section-title text-foreground"
            >
              Preparing your review
            </h2>
            <p className="mt-2 max-w-xl type-body text-muted-foreground">
              Fusion is checking the current account state for each selected
              person before showing the consequences.
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 type-meta text-foreground">
            <Spinner className="size-3.5" />
            Resolving account states
          </div>
        </div>

        <ol
          className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-3"
          aria-label="Activation plan progress"
        >
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" aria-hidden />
            </span>
            <span>
              <span className="block type-label">Scope confirmed</span>
              <span className="block type-meta text-muted-foreground">
                {peopleCount} selected
              </span>
            </span>
          </li>
          <li aria-current="step" className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
              <Spinner className="size-3.5" />
            </span>
            <span>
              <span className="block type-label">Account states</span>
              <span className="block type-meta text-muted-foreground">
                Checking current Fusion accounts
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2.5 opacity-50">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-xs type-label">
              3
            </span>
            <span>
              <span className="block type-label">Consequences</span>
              <span className="block type-meta text-muted-foreground">
                Builds after the check
              </span>
            </span>
          </li>
        </ol>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-7">
          <div className="border-b pb-3">
            <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
            <Skeleton className="mt-2 h-3 w-64 motion-reduce:animate-none" />
          </div>
          <div className="divide-y border-y">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-4 py-4">
                <Skeleton className="size-9 shrink-0 rounded-full motion-reduce:animate-none" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-44 motion-reduce:animate-none" />
                  <Skeleton className="h-3 w-64 max-w-full motion-reduce:animate-none" />
                </div>
                <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="border-y py-5">
            <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
            <Skeleton className="mt-5 h-8 w-20 motion-reduce:animate-none" />
            <Skeleton className="mt-3 h-3 w-36 motion-reduce:animate-none" />
            <div className="mt-5 border-t pt-4">
              <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlanSection({
  group,
  baselines,
  running,
  onBaseline,
  recheckingEmployeeId,
  onEmailSaved,
}: {
  group: PlanGroup;
  baselines: Record<string, WorkforceBaselineChoice>;
  running: boolean;
  onBaseline: (employeeId: string, choice: WorkforceBaselineChoice) => void;
  recheckingEmployeeId: string | null;
  onEmailSaved: (employeeId: string) => Promise<void>;
}) {
  const initialLimit = planGroupInitialLimit(group.kind, group.people.length);
  const [visibleCount, setVisibleCount] = useState(initialLimit);
  const visible = group.people.slice(0, visibleCount);
  const remaining = group.people.length - visibleCount;
  const expansionStep = planGroupExpansionStep(group.kind);

  return (
    <section
      className={cn(
        group.kind === "attention" && "border-l-2 border-warning pl-4"
      )}
    >
      <div className="border-b pb-3">
        <div>
          <h3 className="type-label text-foreground">
            {group.title}{" "}
            <span className="ml-1 tabular-nums text-muted-foreground">
              {group.people.length}
            </span>
          </h3>
          <p className="mt-1 type-meta text-muted-foreground">{group.hint}</p>
        </div>
      </div>
      <div className="divide-y">
        {visible.map(({ subject, candidate }) => (
          <PlanRow
            key={subject.employeeId}
            person={subject}
            candidate={candidate}
            baseline={baselines[subject.employeeId] ?? "Employee"}
            editable={group.actionable && !running}
            showAccountComparison={group.showAccountComparison}
            blocked={group.key === "blocked"}
            onBaseline={(choice) => onBaseline(subject.employeeId, choice)}
            rechecking={recheckingEmployeeId === subject.employeeId}
            onEmailSaved={() => onEmailSaved(subject.employeeId)}
          />
        ))}
      </div>
      {remaining > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(group.people.length, current + expansionStep)
              )
            }
            className="inline-flex items-center gap-1 type-meta font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show {Math.min(expansionStep, remaining)} more{" "}
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
          <span className="type-meta text-muted-foreground" aria-live="polite">
            {visibleCount} of {group.people.length} shown
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function planGroupInitialLimit(
  kind: PlanGroup["kind"],
  count: number
): number {
  switch (kind) {
    case "routine":
      return 6;
    case "attention":
    case "unchanged":
      return 4;
    default:
      return Math.min(6, count);
  }
}

export function planGroupExpansionStep(kind: PlanGroup["kind"]): number {
  return kind === "attention" || kind === "unchanged" ? 10 : 20;
}

function PlanRow({
  person,
  candidate,
  baseline,
  editable,
  showAccountComparison = false,
  blocked = false,
  onBaseline,
  rechecking = false,
  onEmailSaved,
}: {
  person: WorkforceAccessSubjectSummaryDto;
  candidate: WorkforceAccessCandidateDto | null;
  baseline: WorkforceBaselineChoice;
  editable: boolean;
  showAccountComparison?: boolean;
  blocked?: boolean;
  onBaseline: (choice: WorkforceBaselineChoice) => void;
  rechecking?: boolean;
  onEmailSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const recommended = person.directReportCount > 0 ? "Manager" : "Employee";
  const isOverride = baseline !== recommended;

  return (
    <div className="grid gap-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)] sm:items-center">
      <PersonIdentity
        name={person.displayName}
        email={candidate?.workEmail ?? person.workEmail}
        jobTitle={candidate?.jobTitle ?? person.jobTitle}
        organization={candidate?.orgUnit?.name ?? person.orgUnitName}
        employeeNumber={person.employeeNumber}
        accent={showAccountComparison}
      />
      {blocked && isMissingWorkEmail(candidate) ? (
        <div className="sm:col-span-2">
          <InlineWorkEmailEditor
            person={person}
            candidate={candidate!}
            rechecking={rechecking}
            onSaved={onEmailSaved}
          />
        </div>
      ) : (
        <div className="min-w-0 sm:text-right">
          {blocked ? (
            <div className="text-left sm:text-right">
              <p className="type-meta text-muted-foreground">
                {blockedReason(candidate)}
              </p>
              <a
                href={peopleProfilePath(person.stableEmployeeKey)}
                className="mt-2 inline-flex type-meta font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open in People
              </a>
            </div>
          ) : showAccountComparison ? (
            <div className="mb-2 text-left sm:text-right">
              <p className="type-meta text-muted-foreground">
                Employee record: {candidate?.workEmail || "Work email missing"}
              </p>
              <p className="type-meta font-medium text-foreground">
                Fusion account:{" "}
                {candidate?.accountEmail || "Account unavailable"}
              </p>
            </div>
          ) : null}

          {!blocked && editable && editing ? (
            <div
              className="inline-flex rounded-xl border bg-background p-0.5 shadow-sm"
              role="group"
              aria-label={`Access recommendation for ${person.displayName}`}
            >
              {(["Employee", "Manager"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => {
                    onBaseline(choice);
                    setEditing(false);
                  }}
                  aria-pressed={baseline === choice}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 type-meta transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    baseline === choice
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {baseline === choice ? (
                    <Check className="size-3" aria-hidden />
                  ) : null}
                  {choice}
                </button>
              ))}
            </div>
          ) : !blocked ? (
            <div>
              <p className="type-meta font-medium text-foreground">
                {baseline}
              </p>
              {person.directReportCount > 0 ? (
                <p className="type-meta text-muted-foreground">
                  Recommended · {person.directReportCount} active{" "}
                  {person.directReportCount === 1
                    ? "direct report"
                    : "direct reports"}
                </p>
              ) : isOverride ? (
                <p className="type-meta text-muted-foreground">
                  Changed from {recommended} recommendation
                </p>
              ) : null}
              {editable ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-2 inline-flex items-center gap-1 type-meta text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="size-3" aria-hidden /> Change access
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function InlineWorkEmailEditor({
  person,
  candidate,
  rechecking,
  onSaved,
}: {
  person: WorkforceAccessSubjectSummaryDto;
  candidate: WorkforceAccessCandidateDto;
  rechecking: boolean;
  onSaved: () => Promise<void>;
}) {
  const inputId = useId();
  const updateWorkEmail = useUpdateWorkforceWorkEmail();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const busy = saving || updateWorkEmail.isLoading || rechecking;

  async function save() {
    const workEmail = draft.trim().toLowerCase();
    if (!workEmail) {
      setError("Enter a work email.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await updateWorkEmail.mutateAsync({
        employeeKey: person.stableEmployeeKey,
        workEmail,
        expectedVersion: candidate.version,
      });
      setEditing(false);
      await onSaved();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error && mutationError.message.trim()
          ? mutationError.message
          : "The work email could not be saved. Review it and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (rechecking) {
    return (
      <div className="text-left sm:text-right" role="status" aria-live="polite">
        <p className="type-meta font-medium text-foreground">
          Work email saved
        </p>
        <p className="mt-1 inline-flex items-center gap-2 type-meta text-muted-foreground">
          <Spinner className="size-3.5" /> Re-evaluating access…
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="text-left sm:text-right">
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setError(null);
            setEditing(true);
          }}
          className="mt-2 inline-flex type-meta font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Add work email
        </button>
      </div>
    );
  }

  return (
    <form
      className="w-full max-w-md space-y-3 rounded-xl border bg-muted/15 p-3 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <Label htmlFor={inputId}>Work email</Label>
        <Input
          id={inputId}
          className="mt-1.5"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="name@company.com"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <p className="type-meta text-muted-foreground">
        Saved to the canonical People record, then checked again here.
      </p>
      {error ? (
        <p className="type-meta font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="type-meta text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setEditing(false)}
          disabled={busy}
        >
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={!draft.trim() || busy}>
          {busy ? (
            <>
              <Spinner className="mr-1.5 size-3.5" /> Saving…
            </>
          ) : (
            "Save work email"
          )}
        </Button>
      </div>
    </form>
  );
}

function DecisionSummary({
  counts,
  actionableCount,
  running,
  runError,
  onRun,
}: {
  counts: {
    invitations: number;
    links: number;
    reactivations: number;
    connections: number;
    pending: number;
    alreadyActive: number;
    attention: number;
  };
  actionableCount: number;
  running: boolean;
  runError: boolean;
  onRun: () => void;
}) {
  const lines = (
    [
      ["Invitations", counts.invitations],
      ["Employee records linked", counts.links],
      ["Accounts reactivated", counts.reactivations],
      ["Accounts joining this workspace", counts.connections],
      ["Pending unchanged", counts.pending],
      ["Already active", counts.alreadyActive],
    ] satisfies Array<[string, number]>
  ).filter(([, count]) => count > 0);

  return (
    <aside
      className="order-first border-l-2 border-foreground pl-5 lg:order-none lg:sticky lg:top-20"
      aria-label="Activation decision summary"
    >
      <p className="type-eyebrow text-muted-foreground">On confirmation</p>
      <div className="mt-4 space-y-3">
        {lines.map(([label, count]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b pb-2"
          >
            <span className="type-meta text-muted-foreground">{label}</span>
            <span className="type-metric text-foreground">{count}</span>
          </div>
        ))}
      </div>
      {counts.attention > 0 ? (
        <div className="mt-3 flex items-baseline justify-between gap-4 border-b pb-2">
          <span className="flex items-center gap-2 type-meta font-medium text-warning-foreground">
            <AlertTriangle className="size-4" aria-hidden /> Needs review
          </span>
          <span className="type-metric text-warning-foreground">
            {counts.attention}
          </span>
        </div>
      ) : null}
      {runError ? (
        <p className="mt-4 type-meta font-medium text-danger" role="alert">
          The operation did not start. Review the plan and try again.
        </p>
      ) : null}
      <Button
        className="mt-6 w-full"
        size="lg"
        onClick={onRun}
        disabled={running || actionableCount === 0}
      >
        {running ? (
          <>
            <Spinner className="mr-2" /> Confirming workforce access
          </>
        ) : (
          "Confirm workforce access"
        )}
      </Button>
      <p className="mt-2 type-meta text-muted-foreground">
        Each person is processed independently. The receipt records every
        outcome.
      </p>
    </aside>
  );
}

export function planCounts(groups: PlanGroup[]): ActivationPlanCounts {
  const count = (key: string) =>
    groups.find((group) => group.key === key)?.people.length ?? 0;

  return {
    invitations: count("new"),
    links: count("link"),
    reactivations: count("reactivate"),
    connections: count("connect"),
    pending: count("pending"),
    alreadyActive: count("active"),
    attention: count("blocked"),
  };
}

function isMissingWorkEmail(
  candidate: WorkforceAccessCandidateDto | null | undefined
): boolean {
  return candidate?.accountState === "NewAccount" && !candidate.workEmail;
}

function blockedReason(
  candidate: WorkforceAccessCandidateDto | null | undefined
): string {
  if (!candidate) return "This person is no longer available for activation.";
  if (candidate.accountState === "NewAccount" && !candidate.workEmail)
    return "A work email is required before sending an invitation.";
  return (
    candidate.blockedReason ||
    "No access change can be made from the current account state."
  );
}

/** Preserve an outcome for every person reviewed, including people deliberately
 * omitted from the mutation because they are pending, active, or blocked. */
export function buildOperationalReceipt(
  people: WorkforceAccessSubjectSummaryDto[],
  candidates: WorkforceAccessCandidateDto[],
  committedItems: WorkforceAccessBulkResultItemDto[]
): OperationalReceipt {
  const returned = new Map(
    committedItems.map((item) => [item.employeeId, item])
  );
  const resolved = new Map(
    candidates.map((candidate) => [candidate.employeeId, candidate])
  );

  return {
    items: people.map((person) => {
      const committed = returned.get(person.employeeId);
      const resolvedEmail =
        resolved.get(person.employeeId)?.workEmail || person.workEmail || null;
      if (committed) return { ...committed, email: resolvedEmail };

      const candidate = resolved.get(person.employeeId);
      const outcome =
        person.accessState === "InvitePending"
          ? "AlreadyPending"
          : person.accessState === "ActiveAccount"
            ? "AlreadyActive"
            : "Blocked";
      const message =
        person.accessState === "InvitePending"
          ? "The existing invitation remains pending. No new invitation was sent."
          : person.accessState === "ActiveAccount"
            ? "Access was already active. No change was made."
            : blockedReason(candidate);

      return {
        employeeId: person.employeeId,
        displayName: person.displayName,
        outcome,
        accountState: candidate?.accountState ?? null,
        message,
        email: resolvedEmail,
      };
    }),
  };
}

const OUTCOME_LABEL: Record<string, string> = {
  Invited: "Invitation sent",
  Linked: "Employee linked",
  Reactivated: "Account reactivated",
  AlreadyActive: "Already active",
  AlreadyPending: "Invitation unchanged",
  Blocked: "Needs attention",
  Stale: "Changed during review",
  Failed: "Failed",
};

function Receipt({
  receipt,
  onExit,
}: {
  receipt: OperationalReceipt;
  onExit: () => void;
}) {
  const attention = receipt.items.filter((item) =>
    ["Blocked", "Stale", "Failed"].includes(item.outcome)
  );
  const routine = receipt.items.filter(
    (item) => !["Blocked", "Stale", "Failed"].includes(item.outcome)
  );
  const count = (outcome: string) =>
    receipt.items.filter((item) => item.outcome === outcome).length;
  const tallies = (
    [
      ["Invitations sent", count("Invited")],
      ["Employee records linked", count("Linked")],
      ["Accounts reactivated", count("Reactivated")],
      ["Pending unchanged", count("AlreadyPending")],
      ["Already active", count("AlreadyActive")],
      ["Need attention", attention.length],
    ] satisfies Array<[string, number]>
  ).filter(([, value]) => value > 0);

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <p className="type-eyebrow text-muted-foreground">
          Operational receipt
        </p>
        <h2 className="mt-2 type-title text-foreground">
          Workforce access processed
        </h2>
        <p className="mt-2 type-body text-muted-foreground">
          Every person in the reviewed selection has an outcome. No pending
          invitation was resent automatically.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {tallies.map(([label, value]) => (
            <div key={label}>
              <span className="type-metric text-foreground">{value}</span>
              <span className="ml-2 type-meta text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {attention.length > 0 ? (
        <ReceiptGroup
          title="Attention required"
          hint="These people were not changed and may need a follow-up."
          items={attention}
          attention
        />
      ) : null}
      {routine.length > 0 ? (
        <ReceiptGroup
          title="Processed"
          hint="Completed and unchanged outcomes from this operation."
          items={routine}
        />
      ) : null}

      <div className="flex justify-end border-t pt-5">
        <Button onClick={onExit}>Back to workforce access</Button>
      </div>
    </div>
  );
}

function ReceiptGroup({
  title,
  hint,
  items,
  attention = false,
}: {
  title: string;
  hint: string;
  items: OperationalReceiptItem[];
  attention?: boolean;
}) {
  const initialLimit = receiptGroupInitialLimit(attention, items.length);
  const [visibleCount, setVisibleCount] = useState(initialLimit);
  const visible = items.slice(0, visibleCount);
  const remaining = items.length - visibleCount;
  const expansionStep = receiptGroupExpansionStep(attention);

  return (
    <section className={cn(attention && "border-l-2 border-warning pl-4")}>
      <div className="flex items-baseline justify-between gap-4 border-b pb-3">
        <div>
          <h3 className="type-label">
            {title}{" "}
            <span className="ml-1 text-muted-foreground">{items.length}</span>
          </h3>
          <p className="mt-1 type-meta text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="divide-y">
        {visible.map((item) => (
          <div
            key={item.employeeId}
            className="grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="type-label truncate">{item.displayName}</p>
              <p className="truncate type-meta text-muted-foreground">
                {item.email || "Work email missing"}
              </p>
              {attention ? (
                <p className="mt-1 type-meta font-medium text-warning-foreground">
                  {item.message}
                </p>
              ) : null}
            </div>
            <p
              className={cn(
                "type-meta font-medium",
                attention ? "text-warning-foreground" : "text-foreground"
              )}
            >
              {OUTCOME_LABEL[item.outcome] ?? item.outcome}
            </p>
          </div>
        ))}
      </div>
      {remaining > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(items.length, current + expansionStep)
              )
            }
            className="inline-flex items-center gap-1 type-meta font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show {Math.min(expansionStep, remaining)} more
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
          <span className="type-meta text-muted-foreground" aria-live="polite">
            {visibleCount} of {items.length} shown
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function receiptGroupInitialLimit(
  attention: boolean,
  count: number
): number {
  return Math.min(attention ? 4 : 6, count);
}

export function receiptGroupExpansionStep(attention: boolean): number {
  return attention ? 10 : 20;
}
