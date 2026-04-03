"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  Ban,
  Copy,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { ApiError } from "@repo/api";
import { useOrganizations } from "../context/organizations-context";
import {
  buildInviteAcceptPath,
  getOrganizationActionFlags,
} from "../lib/org-action-flags";
import type { Organization } from "../types/organization";
import { cn } from "@/lib/utils";

export function OrganizationRowActions({ org }: { org: Organization }) {
  const {
    ensureOrganization,
    suspendOrganization,
    reactivateOrganization,
    resendFirstAdminInvite,
    revokeFirstAdminInvites,
  } = useOrganizations();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const flags = getOrganizationActionFlags(org);
  const detailHref = `/organizations/${encodeURIComponent(org.id)}`;
  const continueHref = `${detailHref}?focus=setup`;

  const copyInviteLink = useCallback(async () => {
    setBusy(true);
    try {
      let effective = org;
      if (!effective.inviteLink) {
        const fresh = await ensureOrganization(org.id);
        if (fresh) effective = fresh;
      }
      const path = buildInviteAcceptPath(effective);
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const full = path.startsWith("http") ? path : `${origin}${path}`;
      await navigator.clipboard.writeText(full);
      flash("Invite link copied to clipboard.");
    } catch {
      flash("Could not copy link.");
    } finally {
      setBusy(false);
    }
  }, [ensureOrganization, flash, org]);

  const resendInvite = useCallback(async () => {
    setBusy(true);
    try {
      await resendFirstAdminInvite(org.id);
      flash("First admin invite resent.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not resend invite.";
      flash(msg);
    } finally {
      setBusy(false);
    }
  }, [flash, org.id, resendFirstAdminInvite]);

  const revokeInvite = useCallback(async () => {
    setBusy(true);
    try {
      await revokeFirstAdminInvites(org.id);
      flash("Pending invite revoked.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not revoke invite.";
      flash(msg);
    } finally {
      setBusy(false);
    }
  }, [flash, org.id, revokeFirstAdminInvites]);

  const suspend = useCallback(async () => {
    setBusy(true);
    try {
      await suspendOrganization(org.id);
      flash("Organization suspended.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not suspend organization.";
      flash(msg);
    } finally {
      setBusy(false);
    }
  }, [flash, org.id, suspendOrganization]);

  const reactivate = useCallback(async () => {
    setBusy(true);
    try {
      await reactivateOrganization(org.id);
      flash("Organization reactivated.");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : "Could not reactivate.";
      flash(msg);
    } finally {
      setBusy(false);
    }
  }, [flash, org.id, reactivateOrganization]);

  return (
    <div className="relative flex items-center justify-center">
      {toast ? (
        <span
          className="pointer-events-none absolute -top-9 right-0 z-[110] max-w-[14rem] rounded-ch-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-700 shadow-md"
          role="status"
        >
          {toast}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "rounded-ch-md p-2 text-stone-500 transition-colors",
              "hover:bg-ch-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface"
            )}
            title="Organization actions"
            aria-label={`Actions for ${org.name}`}
          >
            <MoreVertical className="h-5 w-5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="core-ui-root z-[120] w-60 rounded-ch-md border border-stone-200 bg-white p-1 text-stone-900 shadow-lg dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        >
          {flags.showView ? (
            <DropdownMenuItem asChild>
              <Link
                href={detailHref}
                className="cursor-pointer rounded-ch-sm data-[highlighted]:bg-ch-surface-container-low data-[highlighted]:text-ch-on-surface"
              >
                <ExternalLink className="h-4 w-4" />
                View organization
              </Link>
            </DropdownMenuItem>
          ) : null}

          {flags.showContinueSetup ? (
            <DropdownMenuItem asChild>
              <Link
                href={continueHref}
                className="cursor-pointer rounded-ch-sm data-[highlighted]:bg-ch-surface-container-low data-[highlighted]:text-ch-on-surface"
              >
                <UserPlus className="h-4 w-4" />
                Continue setup
              </Link>
            </DropdownMenuItem>
          ) : null}

          {flags.showResendFirstAdminInvite ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void resendInvite();
              }}
              className="cursor-pointer rounded-ch-sm data-[highlighted]:bg-ch-surface-container-low data-[highlighted]:text-ch-on-surface"
            >
              <RefreshCw className="h-4 w-4" />
              Resend first admin invite
            </DropdownMenuItem>
          ) : null}

          {flags.showCopyInviteLink ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void copyInviteLink();
              }}
              className="cursor-pointer rounded-ch-sm data-[highlighted]:bg-ch-surface-container-low data-[highlighted]:text-ch-on-surface"
            >
              <Copy className="h-4 w-4" />
              Copy invite link
            </DropdownMenuItem>
          ) : null}

          {flags.showRevokeInvite ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void revokeInvite();
              }}
              className="cursor-pointer rounded-ch-sm text-ch-error data-[highlighted]:bg-ch-error-container/35 data-[highlighted]:text-ch-error"
            >
              <ShieldOff className="h-4 w-4" />
              Revoke invite
            </DropdownMenuItem>
          ) : null}

          {(flags.showSuspend || flags.showReactivate) && (
            <DropdownMenuSeparator className="bg-stone-200 dark:bg-stone-700" />
          )}

          {flags.showSuspend ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void suspend();
              }}
              className="cursor-pointer rounded-ch-sm text-ch-error data-[highlighted]:bg-ch-error-container/35 data-[highlighted]:text-ch-error"
            >
              <Ban className="h-4 w-4" />
              Suspend organization
            </DropdownMenuItem>
          ) : null}

          {flags.showReactivate ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void reactivate();
              }}
              className="cursor-pointer rounded-ch-sm data-[highlighted]:bg-ch-surface-container-low data-[highlighted]:text-ch-on-surface"
            >
              <RotateCcw className="h-4 w-4" />
              Reactivate organization
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
