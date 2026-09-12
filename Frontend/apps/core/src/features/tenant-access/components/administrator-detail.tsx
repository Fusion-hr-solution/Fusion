"use client";

import { useEffect, useState } from "react";
import type { TenantAdministratorDto } from "@repo/api";
import { Button, Separator, cn } from "@repo/ds";
import { AlertCircle, ShieldOff, UserCheck, UserMinus, X } from "lucide-react";
import {
  problemTypeOf,
  useReactivateAdministrator,
  useRecentAccessActivity,
  useRefreshAccessWorkspace,
  useRevokeAdministratorAuthority,
  useSuspendAdministrator,
} from "../api/use-tenant-access";
import {
  ACTIVITY_LABEL,
  ADMINISTRATOR_STATUS_LABEL,
  ADMINISTRATOR_STATUS_TONE,
  COPY,
  formatDay,
  formatMoment,
} from "./access-language";
import { ConfirmDialog, IdentityMark } from "./access-ui";

type PendingAction = "suspend" | "reactivate" | "remove" | null;

const STATUS_DOT = {
  positive: "bg-success",
  caution: "bg-warning",
  neutral: "bg-muted-foreground",
  muted: "bg-muted-foreground/40",
} as const;

interface AdministratorDetailProps {
  administrator: TenantAdministratorDto;
  currentUserId: string | null;
  canManage: boolean;
  onClose: () => void;
  onSelfRemoved: () => void;
  onChanged: (message: string) => void;
}

/**
 * One administrator's access, as a persistent detail surface beside the roster.
 *
 * The actions are deliberately unequal and honest: suspension is reversible and
 * reads as an ordinary action, removal is permanent and sits apart, and the
 * final-administrator rule disables — never hides — what the server would refuse,
 * stating the reason where the action would have been.
 */
export function AdministratorDetail({
  administrator,
  currentUserId,
  canManage,
  onClose,
  onSelfRemoved,
  onChanged,
}: AdministratorDetailProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const suspend = useSuspendAdministrator();
  const reactivate = useReactivateAdministrator();
  const remove = useRevokeAdministratorAuthority();
  const refreshWorkspace = useRefreshAccessWorkspace();
  const activity = useRecentAccessActivity();

  const history = (activity.data ?? [])
    .filter((item) => item.resourceId === administrator.membershipId)
    .slice(0, 4);

  useEffect(() => {
    setProblem(null);
    setPendingAction(null);
  }, [administrator.membershipId]);

  const isSelf =
    currentUserId !== null && administrator.userId === currentUserId;
  const isSuspended = administrator.status === "Suspended";
  const blockedReason = administrator.blockedReason;
  const isBusy = suspend.isLoading || reactivate.isLoading || remove.isLoading;
  const tone = ADMINISTRATOR_STATUS_TONE[administrator.status];

  async function run(action: Exclude<PendingAction, null>) {
    setProblem(null);
    const args = {
      membershipId: administrator.membershipId,
      version: administrator.version,
    };

    try {
      switch (action) {
        case "suspend":
          await suspend.mutateAsync(args);
          onChanged(`${administrator.name} can no longer access this tenant.`);
          break;
        case "reactivate":
          await reactivate.mutateAsync(args);
          onChanged(`${administrator.name} can access this tenant again.`);
          break;
        case "remove":
          await remove.mutateAsync(args);
          onChanged(
            isSelf
              ? "You no longer administer this tenant."
              : `Administrator access removed from ${administrator.name}.`
          );
          break;
      }

      setPendingAction(null);

      if (action === "remove") {
        if (isSelf) {
          onSelfRemoved();
          return;
        }
        onClose();
      }
    } catch (error) {
      switch (problemTypeOf(error)) {
        case "final-administrator":
          await refreshWorkspace();
          break;
        case "stale-state":
          await refreshWorkspace();
          setProblem(COPY.staleState);
          break;
        case "permission-denied":
          setProblem(
            "You no longer have permission to manage administrator access."
          );
          break;
        default:
          setProblem("That change could not be applied.");
      }
      setPendingAction(null);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 p-5">
        <IdentityMark name={administrator.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 type-panel-title text-foreground">
            <span className="truncate">{administrator.name}</span>
            {isSelf ? (
              <span className="type-meta font-normal text-muted-foreground">
                You
              </span>
            ) : null}
          </p>
          <p className="type-meta text-muted-foreground">
            Tenant Administrator
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Close details"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Separator />

      <div className="space-y-3 p-5">
        <p className="type-eyebrow text-muted-foreground">
          Account information
        </p>
        <dl className="space-y-2.5">
          <Field label="Email">{administrator.email}</Field>
          <Field label="Status">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", STATUS_DOT[tone])}
              />
              {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
            </span>
          </Field>
          <Field label="Added on">
            {formatDay(administrator.accessEstablishedAt)}
          </Field>
          <Field label="Added by">{administrator.addedBy}</Field>
        </dl>
      </div>

      {history.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-3 p-5">
            <p className="type-eyebrow text-muted-foreground">Recent activity</p>
            <ul className="space-y-3">
              {history.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                  />
                  <div className="min-w-0">
                    <p className="type-label text-foreground">
                      {ACTIVITY_LABEL[item.action] ?? item.summary}
                    </p>
                    <p className="type-meta text-muted-foreground">
                      {formatMoment(item.occurredAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {canManage ? (
        <>
          <Separator />
          <div className="space-y-2 p-5">
            <p className="type-eyebrow text-muted-foreground">
              Administrator actions
            </p>

            {isSuspended ? (
              <ActionCard
                icon={<UserCheck className="size-4" />}
                title="Reactivate access"
                description="Restore this administrator's access to the tenant."
                disabled={isBusy}
                onClick={() => setPendingAction("reactivate")}
              />
            ) : (
              <ActionCard
                icon={<UserMinus className="size-4" />}
                title="Suspend administrator"
                description="Temporarily remove access. Can be reactivated."
                disabled={isBusy || isSelf || blockedReason !== null}
                onClick={() => setPendingAction("suspend")}
              />
            )}

            <ActionCard
              icon={<ShieldOff className="size-4" />}
              title="Remove administrator authority"
              description="Permanently remove administrator access."
              disabled={isBusy || isSelf || blockedReason !== null}
              onClick={() => setPendingAction("remove")}
            />

            {isSelf ? (
              <ActionCard
                icon={<AlertCircle className="size-4" />}
                title="Remove yourself"
                description="You will lose administrator access immediately, including access to this page."
                destructive
                disabled={isBusy || blockedReason !== null}
                onClick={() => setPendingAction("remove")}
              />
            ) : null}

            {problem ? (
              <p role="alert" className="pt-1 type-meta text-destructive">
                {problem}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "suspend"
            ? "Suspend access"
            : pendingAction === "reactivate"
              ? "Reactivate access"
              : isSelf
                ? "Remove your own administrator access"
                : "Remove administrator access"
        }
        consequence={
          pendingAction === "suspend"
            ? COPY.suspendConsequence
            : pendingAction === "reactivate"
              ? COPY.reactivateConsequence
              : isSelf
                ? COPY.selfRemoveConsequence
                : COPY.removeConsequence
        }
        subject={{ title: administrator.name, subtitle: administrator.email }}
        confirmLabel={
          pendingAction === "suspend"
            ? "Suspend access"
            : pendingAction === "reactivate"
              ? "Reactivate access"
              : "Remove access"
        }
        destructive={pendingAction === "remove"}
        busy={isBusy}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onConfirm={() => pendingAction && void run(pendingAction)}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="type-meta shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate type-label text-right text-foreground">
        {children}
      </dd>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  destructive,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-45",
        destructive
          ? "border-destructive/30 hover:bg-destructive/5"
          : "hover:bg-muted/50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          destructive ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block type-label",
            destructive ? "text-destructive" : "text-foreground"
          )}
        >
          {title}
        </span>
        <span className="block type-meta text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}
