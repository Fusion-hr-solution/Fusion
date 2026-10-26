"use client";

import { useTranslations } from "next-intl";
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
  ADMINISTRATOR_STATUS_TONE,
  useAccessWords,
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
  const t = useTranslations("admins");
  const words = useAccessWords();
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
              ? t("selfRemoved")
              : t("detail.removedFrom", { name: administrator.name })
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
          setProblem(words.copy("staleState"));
          break;
        case "permission-denied":
          setProblem(t("detail.permission"));
          break;
        default:
          setProblem(t("detail.failed"));
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
                {t("detail.you")}
              </span>
            ) : null}
          </p>
          <p className="type-meta text-muted-foreground">
            {t("detail.role")}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("detail.close")}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Separator />

      <div className="space-y-3 p-5">
        <p className="type-eyebrow text-muted-foreground">
          {t("detail.account")}
        </p>
        <dl className="space-y-2.5">
          <Field label={t("detail.email")}>{administrator.email}</Field>
          <Field label={t("detail.status")}>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", STATUS_DOT[tone])}
              />
              {words.status(administrator.status)}
            </span>
          </Field>
          <Field label={t("detail.addedOn")}>
            {words.day(administrator.accessEstablishedAt)}
          </Field>
          <Field label={t("detail.addedBy")}>{administrator.addedBy}</Field>
        </dl>
      </div>

      {history.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-3 p-5">
            <p className="type-eyebrow text-muted-foreground">{t("detail.recent")}</p>
            <ul className="space-y-3">
              {history.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                  />
                  <div className="min-w-0">
                    <p className="type-label text-foreground">
                      {words.activity(item.action, item.summary)}
                    </p>
                    <p className="type-meta text-muted-foreground">
                      {words.moment(item.occurredAt)}
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
              {t("detail.actions")}
            </p>

            {isSuspended ? (
              <ActionCard
                icon={<UserCheck className="size-4" />}
                title={t("detail.reactivate")}
                description={t("detail.reactivateDescription")}
                disabled={isBusy}
                onClick={() => setPendingAction("reactivate")}
              />
            ) : (
              <ActionCard
                icon={<UserMinus className="size-4" />}
                title={t("detail.suspendTitle")}
                description={t("detail.suspendDescription")}
                disabled={isBusy || isSelf || blockedReason !== null}
                onClick={() => setPendingAction("suspend")}
              />
            )}

            <ActionCard
              icon={<ShieldOff className="size-4" />}
              title={t("detail.removeTitle")}
              description={t("detail.removeDescription")}
              disabled={isBusy || isSelf || blockedReason !== null}
              onClick={() => setPendingAction("remove")}
            />

            {isSelf ? (
              <ActionCard
                icon={<AlertCircle className="size-4" />}
                title={t("detail.removeSelfTitle")}
                description={t("detail.removeSelfDescription")}
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
            ? t("detail.suspend")
            : pendingAction === "reactivate"
              ? t("detail.reactivate")
              : isSelf
                ? t("detail.removeOwn")
                : t("detail.removeAccess")
        }
        consequence={
          pendingAction === "suspend"
            ? words.copy("suspendConsequence")
            : pendingAction === "reactivate"
              ? words.copy("reactivateConsequence")
              : isSelf
                ? words.copy("selfRemoveConsequence")
                : words.copy("removeConsequence")
        }
        subject={{ title: administrator.name, subtitle: administrator.email }}
        confirmLabel={
          pendingAction === "suspend"
            ? t("detail.suspend")
            : pendingAction === "reactivate"
              ? t("detail.reactivate")
              : t("detail.remove")
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
      <dd className="min-w-0 truncate type-label text-end text-foreground">
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
        "flex w-full items-start gap-3 rounded-surface border p-3 text-start transition-colors",
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
