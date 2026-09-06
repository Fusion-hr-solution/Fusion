"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  WorkforceAccessCandidateDto,
  WorkforceAccessCommandResultDto,
  WorkforceAccessState,
  WorkforceBaselineChoice,
} from "@repo/api";
import {
  Avatar,
  AvatarFallback,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from "@repo/ds";
import { StatusBadge, PageSkeleton } from "@repo/ds/shell";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock3,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAccessAudit,
  useAccessCandidate,
  useActivateAccess,
  useConnectAccess,
  useLinkAccess,
  useReactivateAccess,
  useResendInvite,
  useRestoreAccess,
  useSuspendAccess,
  useWithdrawInvite,
} from "../api/use-workforce-access";
import {
  CANDIDATE_ACTION_LABEL,
  CANDIDATE_STATE_TONE,
  baselineLabel,
  commandOutcomeMessage,
  initialsOf,
  isCommandSuccess,
} from "./access-language";

/**
 * Context-preserving identity inspector. The drawer is deliberately composed as
 * a decision surface: identify the person, explain the account state, show the
 * relationship that drives the recommendation, then keep the next action anchored.
 */
export function AccountInspector({
  employeeId,
  accessState,
  canManage,
  onOpenChange,
  onCorrect,
}: {
  employeeId: string | null;
  accessState: WorkforceAccessState | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrect?: (candidate: WorkforceAccessCandidateDto) => void;
}) {
  return (
    <Sheet open={employeeId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden p-0 sm:!max-w-xl">
        {employeeId ? (
          <InspectorBody
            employeeId={employeeId}
            accessState={accessState}
            canManage={canManage}
            onCorrect={onCorrect}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InspectorBody({
  employeeId,
  accessState,
  canManage,
  onCorrect,
}: {
  employeeId: string;
  accessState: WorkforceAccessState | null;
  canManage: boolean;
  onCorrect?: (candidate: WorkforceAccessCandidateDto) => void;
}) {
  const candidate = useAccessCandidate(employeeId);

  if (candidate.isLoading) {
    return (
      <>
        <SheetTitle className="sr-only">Loading account</SheetTitle>
        <PageSkeleton rows={6} width="wide" label="Loading account" />
      </>
    );
  }

  if (candidate.error !== null || !candidate.data) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-3 p-7">
        <SheetTitle className="sr-only">Account</SheetTitle>
        <p className="type-body text-muted-foreground">
          This person&apos;s account could not be loaded.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void candidate.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <InspectorContent
      data={candidate.data}
      accessState={accessState}
      canManage={canManage}
      onCorrect={onCorrect}
    />
  );
}

function InspectorContent({
  data,
  accessState,
  canManage,
  onCorrect,
}: {
  data: WorkforceAccessCandidateDto;
  accessState: WorkforceAccessState | null;
  canManage: boolean;
  onCorrect?: (candidate: WorkforceAccessCandidateDto) => void;
}) {
  const [baseline, setBaseline] = useState<WorkforceBaselineChoice>(
    data.recommendedBaseline
  );
  const isPending = accessState === "InvitePending";
  const isSuspended = accessState === "Suspended";
  const isActiveAccount = accessState === "ActiveAccount";

  const audit = useAccessAudit(data.employeeId);
  const resend = useResendInvite();
  const withdraw = useWithdrawInvite();
  const suspend = useSuspendAccess();
  const restore = useRestoreAccess();

  const runLifecycle = async (
    kind: "resend" | "withdraw" | "suspend" | "restore"
  ) => {
    try {
      const runner =
        kind === "resend"
          ? resend
          : kind === "withdraw"
            ? withdraw
            : kind === "suspend"
              ? suspend
              : restore;
      const result = await runner.mutateAsync({ employeeId: data.employeeId });
      const message = commandOutcomeMessage(result.outcome, result.message);
      if (isCommandSuccess(result.outcome)) toast.success(message);
      else toast.error(message);
    } catch {
      toast.error("Something went wrong. Try again.");
    }
  };

  const activate = useActivateAccess();
  const link = useLinkAccess();
  const reactivate = useReactivateAccess();
  const connect = useConnectAccess();
  const pending =
    activate.isLoading ||
    link.isLoading ||
    reactivate.isLoading ||
    connect.isLoading;

  const runAction = async (action: string) => {
    const args = {
      employeeId: data.employeeId,
      baseline,
      expectedVersion: data.version,
    };
    const runner =
      action === "Activate"
        ? activate
        : action === "Link"
          ? link
          : action === "Reactivate"
            ? reactivate
            : action === "Connect"
              ? connect
              : null;
    if (!runner) return;
    try {
      const result: WorkforceAccessCommandResultDto =
        await runner.mutateAsync(args);
      const message = commandOutcomeMessage(result.outcome, result.message);
      if (isCommandSuccess(result.outcome)) toast.success(message);
      else toast.error(message);
    } catch {
      toast.error("Something went wrong. Try again.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-7 pb-6 pt-6 pr-16">
        <div className="flex items-start justify-between gap-4">
          <p className="type-eyebrow text-muted-foreground">Workforce access</p>
          <StatusBadge tone={CANDIDATE_STATE_TONE[data.accountState]} dot>
            {data.accountStateLabel}
          </StatusBadge>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <Avatar size="lg" className="size-14">
            <AvatarFallback className="bg-primary/12 text-primary type-title">
              {initialsOf(data.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle className="truncate text-left text-xl tracking-tight">
              {data.displayName}
            </SheetTitle>
            <SheetDescription className="mt-1 truncate text-left type-body text-muted-foreground">
              {data.jobTitle ?? data.employmentStatus}
            </SheetDescription>
            <p className="mt-1 type-meta text-muted-foreground">
              {data.employeeNumber ?? "Employee record"}
            </p>
          </div>
        </div>
        <p className="mt-5 max-w-prose type-body text-muted-foreground">
          {inspectorStateSummary(data)}
        </p>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y px-7">
          <InspectorSection
            eyebrow="Access recommendation"
            title={baselineLabel(data.directReportCount)}
            description={
              data.directReportCount > 0
                ? `Manager baseline because this person has ${data.directReportCount} active direct report${data.directReportCount === 1 ? "" : "s"}.`
                : "Employee baseline because there are no active direct reports."
            }
          >
            {data.availableActions.length > 0 && canManage ? (
              <div className="mt-4 flex w-fit items-center rounded-lg border bg-muted/30 p-1">
                {(["Employee", "Manager"] as WorkforceBaselineChoice[]).map(
                  (choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setBaseline(choice)}
                      className={cn(
                        "rounded-md px-3 py-1.5 type-label transition-colors",
                        baseline === choice
                          ? "bg-foreground text-background shadow-raised"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {choice}
                    </button>
                  )
                )}
              </div>
            ) : null}
          </InspectorSection>

          <InspectorSection eyebrow="Person relationship" title="People record">
            <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Detail
                label="Work email"
                value={data.workEmail ?? "Not set"}
                missing={!data.workEmail}
              />
              <Detail
                label="Organization"
                value={data.orgUnit?.name ?? "Not assigned"}
              />
              <div className="sm:col-span-2">
                <p className="type-eyebrow text-muted-foreground">Manager</p>
                {data.manager ? (
                  <div className="mt-2 flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-muted text-muted-foreground type-meta">
                        {initialsOf(data.manager.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="type-label text-foreground">
                        {data.manager.displayName}
                      </p>
                      <p className="type-meta text-muted-foreground">
                        {data.manager.isActive
                          ? "Active manager"
                          : "Inactive manager"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 type-body text-muted-foreground">
                    No manager assigned
                  </p>
                )}
              </div>
              <Detail
                label="Direct reports"
                value={`${data.directReportCount} active ${data.directReportCount === 1 ? "report" : "reports"}`}
              />
              <Detail label="Employment" value={data.employmentStatus} />
            </div>
          </InspectorSection>

          <InspectorSection eyebrow="Fusion account" title="Account footprint">
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <Mail
                  className="mt-0.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="type-eyebrow text-muted-foreground">
                    Account email
                  </p>
                  <p className="mt-1 truncate type-body text-foreground">
                    {data.accountEmail ?? "No Fusion account linked"}
                  </p>
                </div>
              </div>
              {data.additionalAccess && data.additionalAccess.length > 0 ? (
                <div>
                  <p className="type-eyebrow text-muted-foreground">
                    Additional access
                  </p>
                  <p className="mt-1 type-body text-foreground">
                    {data.additionalAccess.join(" · ")}
                  </p>
                </div>
              ) : null}
              {data.isAdministrator ? (
                <div className="flex items-start gap-3 rounded-lg bg-muted/40 px-3 py-3">
                  <ShieldCheck
                    className="mt-0.5 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="type-meta text-muted-foreground">
                    Tenant Administrator authority is managed under
                    Administrators and is preserved here.
                  </p>
                </div>
              ) : null}
            </div>
          </InspectorSection>

          {audit.data && audit.data.length > 0 ? (
            <InspectorSection eyebrow="Audit trail" title="Recent activity">
              <ol className="mt-4 space-y-4">
                {audit.data.slice(0, 5).map((line, index) => (
                  <li key={index} className="relative flex gap-3">
                    <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {index === 0 ? (
                        <Clock3 className="size-3" aria-hidden="true" />
                      ) : (
                        <Check className="size-3" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="type-label text-foreground">
                        {line.summary}
                      </p>
                      <p className="mt-0.5 type-meta text-muted-foreground">
                        {new Date(line.occurredAt).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </InspectorSection>
          ) : null}
        </div>
      </div>

      <InspectorActions
        data={data}
        canManage={canManage}
        onCorrect={onCorrect}
        isPending={isPending}
        isSuspended={isSuspended}
        isActiveAccount={isActiveAccount}
        pending={pending}
        baseline={baseline}
        runAction={runAction}
        runLifecycle={runLifecycle}
        resendLoading={resend.isLoading}
        withdrawLoading={withdraw.isLoading}
        suspendLoading={suspend.isLoading}
        restoreLoading={restore.isLoading}
      />
    </div>
  );
}

function InspectorActions({
  data,
  canManage,
  onCorrect,
  isPending,
  isSuspended,
  isActiveAccount,
  pending,
  baseline,
  runAction,
  runLifecycle,
  resendLoading,
  withdrawLoading,
  suspendLoading,
  restoreLoading,
}: {
  data: WorkforceAccessCandidateDto;
  canManage: boolean;
  onCorrect?: (candidate: WorkforceAccessCandidateDto) => void;
  isPending: boolean;
  isSuspended: boolean;
  isActiveAccount: boolean;
  pending: boolean;
  baseline: WorkforceBaselineChoice;
  runAction: (action: string) => Promise<void>;
  runLifecycle: (
    kind: "resend" | "withdraw" | "suspend" | "restore"
  ) => Promise<void>;
  resendLoading: boolean;
  withdrawLoading: boolean;
  suspendLoading: boolean;
  restoreLoading: boolean;
}) {
  return (
    <div className="border-t bg-background px-7 py-4">
      {data.availableActions.length > 0 && canManage ? (
        <div className="space-y-2">
          {data.availableActions.map((action) => (
            <Button
              key={action}
              className="w-full"
              disabled={pending}
              onClick={() => void runAction(action)}
            >
              {CANDIDATE_ACTION_LABEL[action] ?? action}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
          ))}
          <p className="text-center type-meta text-muted-foreground">
            Baseline: {baseline}
          </p>
        </div>
      ) : isPending && canManage ? (
        <div className="space-y-2">
          <p className="type-meta text-muted-foreground">
            This invitation is still pending. Choose whether to send a fresh
            link or leave it untouched.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={resendLoading || withdrawLoading}
              onClick={() => void runLifecycle("resend")}
            >
              Resend invitation
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={resendLoading || withdrawLoading}
              onClick={() => void runLifecycle("withdraw")}
            >
              Withdraw
            </Button>
          </div>
        </div>
      ) : data.isAdministrator ? (
        <div className="space-y-2">
          <p className="type-meta text-muted-foreground">
            Administrator authority is managed separately.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/access">
              Open Administrators
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : isSuspended && canManage ? (
        <div className="space-y-2">
          <p className="type-meta text-muted-foreground">
            Access is suspended. The account and its history are preserved.
          </p>
          <Button
            className="w-full"
            disabled={restoreLoading}
            onClick={() => void runLifecycle("restore")}
          >
            Restore access
          </Button>
        </div>
      ) : isActiveAccount && canManage ? (
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={suspendLoading}
            onClick={() => void runLifecycle("suspend")}
          >
            Suspend access
          </Button>
          {onCorrect ? (
            <button
              type="button"
              onClick={() => onCorrect(data)}
              className="flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 type-meta text-muted-foreground transition-colors hover:text-foreground"
            >
              Wrong person? Correct identity link
            </button>
          ) : null}
        </div>
      ) : data.accountState === "Active" ? (
        <p className="type-meta text-muted-foreground">
          This person already has active Fusion access.
        </p>
      ) : !canManage ? (
        <p className="type-meta text-muted-foreground">
          You can view workforce access but not change it.
        </p>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-warning-subtle px-3 py-3">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="type-meta text-warning-foreground">
            {data.blockedReason ?? "No action is available for this account."}
          </p>
        </div>
      )}
    </div>
  );
}

function InspectorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="py-6 first:pt-7 last:pb-8">
      <p className="type-eyebrow text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-1 type-title text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-prose type-meta text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  missing = false,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate type-body",
          missing ? "text-warning-foreground" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function inspectorStateSummary(data: WorkforceAccessCandidateDto): string {
  if (data.blockedReason) return data.blockedReason;
  switch (data.accountState) {
    case "NewAccount":
      return "No Fusion account is linked yet. Review the recommendation before sending access.";
    case "ExistingAccountReadyToLink":
      return "A Fusion account matches this person. Linking preserves the existing account and its access.";
    case "ExistingAccountReadyToJoinTenant":
      return "A Fusion account can join this tenant. Review the baseline before connecting it.";
    case "SuspendedAccountReadyToReactivate":
      return "A suspended account is available to reactivate and link to this workforce record.";
    case "Active":
      return "This person already has active Fusion access.";
    default:
      return data.accountStateLabel;
  }
}
