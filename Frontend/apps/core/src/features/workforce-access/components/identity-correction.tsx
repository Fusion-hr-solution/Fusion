"use client";

import { useMemo, useState } from "react";
import type {
  WorkforceAccessCandidateDto,
  WorkforceAccessSubjectSummaryDto,
  WorkforceBaselineChoice,
} from "@repo/api";
import { Avatar, AvatarFallback, Button, Input, Textarea } from "@repo/ds";
import { StatusBadge } from "@repo/ds/shell";
import { ArrowRight, Search } from "lucide-react";
import { useAccessRoster, useCorrectIdentity } from "../api/use-workforce-access";
import {
  baselineLabel,
  commandOutcomeMessage,
  initialsOf,
  isCommandSuccess,
} from "./access-language";

/**
 * Single-person identity correction. A focused, consequential full-width surface — not a
 * dialog and not a wizard: the current relationship, a canonical People search for the
 * corrected person, a side-by-side before/after, the reviewed baseline, and a required
 * reason, resolved on one page. The account is never deleted or recreated; the server
 * rebinds it atomically and the corrected person must sign in again.
 */
export function IdentityCorrection({
  source,
  onBack,
  onDone,
}: {
  source: WorkforceAccessCandidateDto;
  onBack: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<WorkforceAccessSubjectSummaryDto | null>(null);
  const [baseline, setBaseline] = useState<WorkforceBaselineChoice>("Employee");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const correct = useCorrectIdentity();

  const trimmedReason = reason.trim();
  const canSubmit = target !== null && trimmedReason.length > 0 && !correct.isLoading;

  const chooseTarget = (person: WorkforceAccessSubjectSummaryDto) => {
    setTarget(person);
    setBaseline(person.directReportCount > 0 ? "Manager" : "Employee");
    setError(null);
  };

  const submit = async () => {
    if (!target) return;
    setError(null);
    try {
      const result = await correct.mutateAsync({
        employeeId: source.employeeId,
        targetEmployeeId: target.employeeId,
        baseline,
        reason: trimmedReason,
        expectedVersion: source.accountRevision ?? 0,
      });
      if (isCommandSuccess(result.outcome)) {
        onDone();
        return;
      }
      // Typed, non-disclosing failure: keep the reviewed data visible and explain in the
      // shared outcome vocabulary. A stale/conflict outcome is recoverable by re-reviewing.
      setError(commandOutcomeMessage(result.outcome, result.message));
    } catch {
      setError("Something went wrong. Try again.");
    }
  };

  return (
    <div className="space-y-7">
      <button
        type="button"
        onClick={onBack}
        className="type-meta text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to workforce access
      </button>

      {/* Current relationship — what the account is linked to today. */}
      <section className="space-y-3">
        <h2 className="type-eyebrow text-muted-foreground">Current relationship</h2>
        <div className="rounded-xl border p-4">
          <PersonLine
            name={source.displayName}
            detail={source.accountEmail ?? source.workEmail ?? source.jobTitle ?? "Linked account"}
          />
          <p className="mt-2 type-meta text-muted-foreground">
            This Fusion account is linked to {source.displayName}.
          </p>
        </div>
      </section>

      {/* Choose the corrected person. */}
      <section className="space-y-3">
        <h2 className="type-eyebrow text-muted-foreground">Corrected person</h2>
        {target ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <PersonLine
              name={target.displayName}
              detail={target.workEmail || "No work email"}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTarget(null);
                setError(null);
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <TargetSearch
            query={query}
            onQuery={setQuery}
            excludeEmployeeId={source.employeeId}
            onChoose={chooseTarget}
          />
        )}
      </section>

      {/* Review the change before committing. */}
      {target ? (
        <>
          <section className="space-y-3">
            <h2 className="type-eyebrow text-muted-foreground">Review the change</h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <BeforeAfter label="Before" name={source.displayName} tone="muted" />
              <ArrowRight
                aria-hidden
                className="mx-auto hidden size-5 text-muted-foreground sm:block"
              />
              <BeforeAfter label="After" name={target.displayName} tone="success" />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="type-eyebrow text-muted-foreground">Access baseline</h2>
            <div className="inline-flex rounded-lg border p-0.5">
              {(["Employee", "Manager"] as WorkforceBaselineChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setBaseline(choice)}
                  className={`rounded-md px-3 py-1 type-label transition-colors ${
                    baseline === choice
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
            <p className="type-meta text-muted-foreground">
              Recommended: {baselineLabel(target.directReportCount)}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="type-eyebrow text-muted-foreground">Reason</h2>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this account being corrected?"
              rows={3}
              aria-label="Correction reason"
            />
          </section>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
              <p className="type-meta text-destructive">{error}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <p className="type-meta text-muted-foreground">
              The corrected person will need to sign in again.
            </p>
            <Button disabled={!canSubmit} onClick={() => void submit()}>
              {correct.isLoading ? "Correcting…" : "Correct identity link"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TargetSearch({
  query,
  onQuery,
  excludeEmployeeId,
  onChoose,
}: {
  query: string;
  onQuery: (value: string) => void;
  excludeEmployeeId: string;
  onChoose: (person: WorkforceAccessSubjectSummaryDto) => void;
}) {
  const filters = useMemo(() => ({ search: query.trim() || null, access: null }), [query]);
  const roster = useAccessRoster(filters, 1, 8, query.trim().length > 0);

  // A valid corrected person has no binding of their own. People already bound to an
  // account (active or suspended) are excluded; the server uniqueness check is the final
  // guard for anything the roster cannot rule out.
  const results = (roster.data?.items ?? []).filter(
    (person) =>
      person.employeeId !== excludeEmployeeId &&
      person.accessState !== "ActiveAccount" &&
      person.accessState !== "Suspended"
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search people by name, email, or employee number"
          className="pl-9"
          aria-label="Search for the corrected person"
        />
      </div>

      {query.trim().length === 0 ? null : roster.isLoading ? (
        <p className="type-meta text-muted-foreground">Searching…</p>
      ) : results.length === 0 ? (
        <p className="type-meta text-muted-foreground">
          No unlinked people match that search.
        </p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {results.map((person) => (
            <button
              key={person.employeeId}
              type="button"
              onClick={() => onChoose(person)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <PersonLine
                name={person.displayName}
                detail={person.workEmail || "No work email"}
              />
              <StatusBadge tone="muted" dot>
                {person.accessStateLabel}
              </StatusBadge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonLine({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar>
        <AvatarFallback className="type-meta bg-muted text-muted-foreground">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="type-label truncate text-foreground">{name}</p>
        <p className="truncate type-meta text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function BeforeAfter({
  label,
  name,
  tone,
}: {
  label: string;
  name: string;
  tone: "muted" | "success";
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <StatusBadge tone={tone} dot>
          {tone === "muted" ? "Was" : "Will be"}
        </StatusBadge>
        <span className="truncate type-label text-foreground">{name}</span>
      </div>
    </div>
  );
}
