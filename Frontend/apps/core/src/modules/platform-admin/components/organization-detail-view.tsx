"use client";

import { useCallback, useMemo, useState } from "react";
import { Archive, ChevronRight, PauseCircle, RotateCcw } from "lucide-react";
import { ApiError } from "@repo/api";
import { cn } from "@/lib/utils";
import type { Organization } from "../types/organization";
import { useOrganizations } from "../context/organizations-context";
import { buildInviteAcceptUrl } from "../lib/org-action-flags";
import { PlatformAdminBreadcrumbs } from "./platform-admin-breadcrumbs";
import { ConfirmDialog } from "./confirm-dialog";

function lifecyclePillLabel(lifecycle: Organization["lifecycle"]): string {
  switch (lifecycle) {
    case "draft":
      return "Lifecycle: Draft";
    case "active":
      return "Lifecycle: Active";
    case "invited":
      return "Lifecycle: Invited";
    case "attention":
      return "Lifecycle: Attention Needed";
    case "suspended":
      return "Lifecycle: Suspended";
    case "archived":
      return "Lifecycle: Archived";
    default:
      return "Lifecycle";
  }
}

function handoffCopy(org: Organization) {
  if (org.lifecycle === "archived") {
    return { dot: "bg-stone-500", headline: "Archived" };
  }
  if (org.lifecycle === "suspended") {
    return {
      dot: "bg-stone-500",
      headline: "Suspended",
    };
  }
  if (org.lifecycle === "active") {
    return {
      dot: "bg-ch-tertiary",
      headline: "Live",
    };
  }
  if (org.lifecycle === "attention") {
    return {
      dot: "bg-ch-error",
      headline: "Action Required",
    };
  }
  if (org.lifecycle === "draft") {
    return { dot: "bg-stone-400", headline: "Draft" };
  }
  return {
    dot: "bg-yellow-400",
    headline: "Pending Approval",
  };
}

function adminInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "AD";
}

export function OrganizationDetailView({ org }: { org: Organization }) {
  const {
    resendFirstAdminInvite,
    revokeFirstAdminInvites,
    suspendOrganization,
    reactivateOrganization,
    archiveOrganization,
    ensureOrganization,
  } = useOrganizations();
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<
    "suspend" | "archive" | "revoke" | null
  >(null);

  const handoff = useMemo(() => handoffCopy(org), [org]);

  // Determine which actions should be available based on lifecycle
  const canResendInvite =
    org.pendingInvites > 0 &&
    org.lifecycle !== "suspended" &&
    org.lifecycle !== "archived" &&
    (org.lifecycle === "invited" ||
      org.lifecycle === "attention" ||
      org.lifecycle === "draft");

  const canCopyInvite = Boolean(org.inviteLink);
  const canRevokeInvite =
    (org.lifecycle === "invited" || org.lifecycle === "draft") &&
    org.pendingInvites > 0;

  const onResend = useCallback(async () => {
    setBusy(true);
    try {
      await resendFirstAdminInvite(org.id);
      await ensureOrganization(org.id);
      setActionBanner("Invitation resent successfully.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not resend invitation.";
      setActionBanner(msg);
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setActionBanner(null), 4000);
  }, [ensureOrganization, org.id, resendFirstAdminInvite]);

  const onCopyLink = useCallback(async () => {
    let effective = org;
    if (!effective.inviteLink) {
      const fresh = await ensureOrganization(org.id);
      if (fresh) effective = fresh;
    }
    const url = buildInviteAcceptUrl(effective);
    if (!url) {
      setActionBanner("No invite link available.");
      window.setTimeout(() => setActionBanner(null), 3500);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setActionBanner("Invite link copied to clipboard.");
    } catch {
      setActionBanner("Unable to copy link.");
    }
    window.setTimeout(() => setActionBanner(null), 3500);
  }, [ensureOrganization, org]);

  const onRevoke = useCallback(async () => {
    setBusy(true);
    try {
      await revokeFirstAdminInvites(org.id);
      await ensureOrganization(org.id);
      setActionBanner("Invite revoked.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not revoke invite.";
      setActionBanner(msg);
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setActionBanner(null), 4000);
  }, [ensureOrganization, org.id, revokeFirstAdminInvites]);

  const onSuspend = useCallback(async () => {
    setBusy(true);
    try {
      await suspendOrganization(org.id);
      await ensureOrganization(org.id);
      setActionBanner("Organization suspended.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not suspend organization.";
      setActionBanner(msg);
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setActionBanner(null), 4000);
  }, [ensureOrganization, org.id, suspendOrganization]);

  const onReactivate = useCallback(async () => {
    setBusy(true);
    try {
      await reactivateOrganization(org.id);
      await ensureOrganization(org.id);
      setActionBanner("Organization reactivated.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not reactivate.";
      setActionBanner(msg);
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setActionBanner(null), 4000);
  }, [ensureOrganization, org.id, reactivateOrganization]);

  const onArchive = useCallback(async () => {
    setBusy(true);
    try {
      await archiveOrganization(org.id);
      await ensureOrganization(org.id);
      setActionBanner("Organization archived.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not archive organization.";
      setActionBanner(msg);
    } finally {
      setBusy(false);
    }
    window.setTimeout(() => setActionBanner(null), 4000);
  }, [archiveOrganization, ensureOrganization, org.id]);

  return (
    <main className="mx-auto w-full max-w-7xl bg-ch-surface font-chBody text-ch-on-surface">
      {actionBanner && (
        <p
          className="mb-6 rounded-ch-md bg-ch-surface-container-low px-4 py-2 text-sm font-medium text-ch-on-surface"
          role="status"
        >
          {actionBanner}
        </p>
      )}

      <div className="mb-6">
        <PlatformAdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Organizations", href: "/organizations" },
            { label: org.name },
          ]}
        />
      </div>

      <header className="mb-10">
        <div className="mb-2 flex flex-wrap items-center gap-4">
          <span className="rounded-full bg-ch-primary-container px-3 py-1 font-chHeadline text-[10px] font-black uppercase tracking-widest text-ch-on-primary-container">
            {lifecyclePillLabel(org.lifecycle)}
          </span>
          <span className="font-chBody text-sm tracking-tight text-stone-400">
            • Created {org.createdAt}
          </span>
        </div>
        <div className="flex flex-col items-end justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="mb-2 font-chHeadline text-5xl font-extrabold tracking-tighter text-ch-on-surface">
              {org.name}
            </h1>
            <p className="max-w-xl font-chBody text-stone-500">
              {org.description}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="bg-ch-secondary-container px-6 py-2.5 text-sm font-bold tracking-tight text-ch-on-secondary-container transition-all hover:bg-ch-surface-container-high"
            >
              Export Report
            </button>
            <button
              type="button"
              className="bg-ch-primary-container px-6 py-2.5 text-sm font-bold tracking-tight text-ch-on-primary-container transition-all hover:opacity-90"
            >
              Edit Details
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="grid grid-cols-1 gap-1 overflow-hidden bg-ch-surface-container-low p-1 md:grid-cols-3">
            <div className="flex aspect-square flex-col justify-between bg-ch-surface-container-lowest p-8 md:aspect-auto">
              <span className="mb-8 font-chHeadline text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
                Active Users
              </span>
              <div>
                <div className="font-chHeadline text-6xl font-black tracking-tighter text-stone-900">
                  {org.userCount}
                </div>
                <div className="mt-2 h-1 w-12 bg-stone-100" />
              </div>
            </div>
            <div className="flex aspect-square flex-col justify-between bg-ch-surface-container-lowest p-8 md:aspect-auto">
              <span className="mb-8 font-chHeadline text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
                Pending Invites
              </span>
              <div>
                <div className="font-chHeadline text-6xl font-black tracking-tighter text-ch-primary">
                  {org.pendingInvites}
                </div>
                <div className="mt-2 h-1 w-12 bg-ch-primary-container" />
              </div>
            </div>
            <div className="flex aspect-square flex-col justify-between bg-ch-surface-container-lowest p-8 md:aspect-auto">
              <span className="mb-8 font-chHeadline text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
                Onboarding State
              </span>
              <div>
                <div className="font-chHeadline text-lg font-bold leading-tight text-stone-900">
                  {org.onboardingStageTitle}
                </div>
                <p className="mt-1 font-chBody text-xs text-stone-500">
                  {org.onboardingStageSubtitle}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-ch-surface-container-low p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-chHeadline text-sm font-black uppercase tracking-[0.2em] text-stone-900">
                Designated Personnel
              </h3>
              <button
                type="button"
                className="font-chBody text-xs font-bold text-ch-primary hover:underline"
              >
                View All People
              </button>
            </div>
            <div className="space-y-1">
              {org.primaryAdminName && org.primaryAdminEmail ? (
                <div className="group flex items-center justify-between bg-ch-surface-container-lowest p-4 transition-colors hover:bg-stone-50">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center bg-stone-200 font-bold text-stone-600">
                      {adminInitials(org.primaryAdminName)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">
                        {org.primaryAdminName}
                      </p>
                      <p className="text-xs text-stone-500">
                        {org.primaryAdminEmail}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-ch-tertiary/10 px-3 py-1 font-chHeadline text-[10px] font-bold uppercase tracking-widest text-ch-tertiary">
                      Primary Admin
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  No designated administrator recorded.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <section className="relative h-full overflow-hidden bg-stone-900 p-8 text-white">
            <div className="absolute -right-12 -top-12 h-32 w-32 bg-yellow-400/10 blur-[60px]" />
            <h3 className="mb-6 font-chHeadline text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              Hand-off Tracking
            </h3>
            <div className="relative z-10 space-y-6">
              <div>
                <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                  Current Status
                </p>
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", handoff.dot)} />
                  <span className="font-chHeadline text-lg font-bold">
                    {handoff.headline}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                    Sent Time
                  </p>
                  <p className="text-sm font-medium">
                    {org.inviteSentAt ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                    Expiry
                  </p>
                  <p className="text-sm font-medium">
                    {org.inviteExpiresAt ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="button"
                  disabled={busy || !canResendInvite}
                  onClick={() => void onResend()}
                  className="w-full bg-yellow-400 py-3 font-chHeadline text-xs font-black uppercase tracking-widest text-stone-900 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Resend Invite
                </button>
                <button
                  type="button"
                  disabled={busy || !canCopyInvite}
                  onClick={() => void onCopyLink()}
                  className="w-full border border-stone-700 py-3 font-chHeadline text-xs font-black uppercase tracking-widest text-stone-300 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy Invite Link
                </button>
                <button
                  type="button"
                  disabled={busy || !canRevokeInvite}
                  onClick={() => setConfirmAction("revoke")}
                  className="w-full border border-ch-error/50 py-3 font-chHeadline text-xs font-black uppercase tracking-widest text-ch-error transition-colors hover:bg-ch-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Revoke Pending Invite
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="flex flex-col bg-ch-surface-container-low p-6 lg:col-span-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="mb-2 font-chHeadline text-sm font-black uppercase tracking-[0.2em] text-stone-900">
                Onboarding Lifecycle
              </h3>
              <p className="font-chBody text-xs text-stone-500">
                Lifecycle-derived progress estimate for operational visibility.
              </p>
            </div>
            <div className="text-right">
              <p className="font-chHeadline text-2xl font-black text-stone-900">
                {org.onboardingProgressPercent}%
              </p>
              <p className="font-chHeadline text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Total Progress
              </p>
            </div>
          </div>
          <div className="relative mb-4 h-2 overflow-hidden bg-stone-200">
            <div
              className="absolute left-0 top-0 h-full bg-ch-primary transition-[width] duration-500"
              style={{ width: `${org.onboardingProgressPercent}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                Current Stage
              </p>
              <p className="text-sm font-bold text-stone-900">
                {org.onboardingStageTitle}
              </p>
            </div>
            <div>
              <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                Created On
              </p>
              <p className="text-sm font-bold text-stone-900">
                {org.createdAt ?? "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                Invite Status
              </p>
              <p className="text-sm font-bold text-stone-900">
                {org.inviteSentAt ? "Sent" : "Not Sent"}
              </p>
            </div>
            <div>
              <p className="mb-1 font-chHeadline text-[10px] font-bold uppercase text-stone-400">
                Next Action
              </p>
              <p className="text-sm font-bold text-stone-900">
                {org.onboardingStageSubtitle || "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="h-full bg-ch-surface-container-low p-6 lg:col-span-4">
          <h3 className="mb-4 font-chHeadline text-xs font-black uppercase tracking-[0.2em] text-stone-900">
            Governance Controls
          </h3>
          <div className="space-y-px">
            <button
              type="button"
              disabled={busy || org.lifecycle !== "active"}
              onClick={() => setConfirmAction("suspend")}
              className="group flex w-full items-center justify-between bg-ch-surface-container-lowest py-2 pl-3 pr-3 font-chBody text-sm font-bold text-stone-900 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <PauseCircle className="h-5 w-5 text-stone-400" />
                <span>Suspend Organization</span>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-300 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              disabled={busy || org.lifecycle !== "suspended"}
              onClick={() => void onReactivate()}
              className="group flex w-full items-center justify-between bg-ch-surface-container-lowest py-2 pl-3 pr-3 font-chBody text-sm font-bold text-stone-900 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <RotateCcw className="h-5 w-5 text-ch-tertiary" />
                <span>Reactivate Organization</span>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-300 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              disabled={busy || org.lifecycle === "archived"}
              onClick={() => setConfirmAction("archive")}
              className="group flex w-full items-center justify-between bg-ch-surface-container-lowest py-2 pl-3 pr-3 font-chBody text-sm font-bold text-ch-error transition-colors hover:bg-ch-error-container/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <Archive className="h-5 w-5" />
                <span>Archive {org.name}</span>
              </div>
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmAction === "suspend"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Suspend Organization"
        description={`This will temporarily disable access for all users in ${org.name}. The organization can be reactivated later.`}
        confirmLabel="Suspend"
        variant="destructive"
        onConfirm={onSuspend}
        loading={busy}
      />
      <ConfirmDialog
        open={confirmAction === "archive"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Archive Organization"
        description={`This will permanently archive ${org.name}. Archived organizations cannot be restored. All user access will be revoked.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={onArchive}
        loading={busy}
      />
      <ConfirmDialog
        open={confirmAction === "revoke"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Revoke Invitation"
        description="This will cancel the pending invitation. The invitee will no longer be able to use the invite link."
        confirmLabel="Revoke Invite"
        variant="destructive"
        onConfirm={onRevoke}
        loading={busy}
      />
    </main>
  );
}
