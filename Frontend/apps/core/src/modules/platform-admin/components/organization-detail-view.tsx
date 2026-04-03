"use client";

import { useCallback, useMemo, useState } from "react";
import { Archive, ChevronRight, PauseCircle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Organization } from "../types/organization";
import { useOrganizations } from "../context/organizations-context";
import { PlatformAdminBreadcrumbs } from "./platform-admin-breadcrumbs";

function formatShortStamp(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function lifecyclePillLabel(lifecycle: Organization["lifecycle"]): string {
  switch (lifecycle) {
    case "active":
      return "Lifecycle: Active";
    case "invited":
      return "Lifecycle: Invited";
    case "attention":
      return "Lifecycle: Attention Needed";
    case "suspended":
      return "Lifecycle: Suspended";
    default:
      return "Lifecycle";
  }
}

function handoffCopy(org: Organization) {
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
  const { updateOrganization } = useOrganizations();
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  const handoff = useMemo(() => handoffCopy(org), [org]);

  const onResend = useCallback(() => {
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    updateOrganization(org.id, {
      inviteSentAt: formatShortStamp(now),
      inviteExpiresAt: formatShortStamp(expires),
    });
    setActionBanner("Invitation resent successfully.");
    window.setTimeout(() => setActionBanner(null), 4000);
  }, [org.id, updateOrganization]);

  const onCopyLink = useCallback(async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const path = `/core/invite/accept?org=${encodeURIComponent(org.name)}&email=${encodeURIComponent(org.primaryAdminEmail ?? "")}`;
    const text = `${origin}${path}`;
    try {
      await navigator.clipboard.writeText(text);
      setActionBanner("Invite link copied to clipboard.");
    } catch {
      setActionBanner("Unable to copy link.");
    }
    window.setTimeout(() => setActionBanner(null), 3500);
  }, [org.name, org.primaryAdminEmail]);

  const milestones = useMemo(() => {
    const p = org.onboardingProgressPercent;
    const inviteActive =
      org.lifecycle === "invited" ||
      (org.lifecycle === "attention" && p < 50);
    return [
      {
        key: "creation",
        title: "Creation",
        sub: `Completed ${org.createdAt}`,
        dim: false,
        border: false,
        accent: false,
      },
      {
        key: "invitation",
        title: "Invitation",
        sub:
          inviteActive && p >= 25
            ? "Active Stage"
            : p >= 50
              ? "Completed"
              : "—",
        dim: p < 25,
        border: inviteActive && p >= 25,
        accent: inviteActive && p >= 25,
      },
      {
        key: "verification",
        title: "Verification",
        sub:
          p >= 100
            ? "Completed"
            : p >= 50
              ? "In progress"
              : "Locked",
        dim: p < 50,
        border: false,
        accent: p >= 50 && p < 100,
      },
      {
        key: "production",
        title: "Production",
        sub: p >= 100 ? "Live" : "Locked",
        dim: p < 100,
        border: false,
        accent: p >= 100,
      },
    ];
  }, [org]);

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
            <p className="max-w-xl font-chBody text-stone-500">{org.description}</p>
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
                  onClick={onResend}
                  className="w-full bg-yellow-400 py-3 font-chHeadline text-xs font-black uppercase tracking-widest text-stone-900 transition-colors hover:bg-yellow-300"
                >
                  Resend Invite
                </button>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="w-full border border-stone-700 py-3 font-chHeadline text-xs font-black uppercase tracking-widest text-stone-300 transition-colors hover:bg-stone-800"
                >
                  Copy Invite Link
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
                Milestones achieved in the last 24 hours.
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
          <div className="relative h-2 overflow-hidden bg-stone-200">
            <div
              className="absolute left-0 top-0 h-full bg-ch-primary transition-[width] duration-500"
              style={{ width: `${org.onboardingProgressPercent}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {milestones.map((m) => (
              <div
                key={m.key}
                className={cn(
                  m.border && "border-l-2 border-ch-primary pl-4",
                  m.dim && "opacity-30"
                )}
              >
                <p
                  className={cn(
                    "mb-1 font-chHeadline text-[10px] font-black uppercase",
                    m.accent ? "text-ch-primary" : "text-stone-900",
                    m.dim && "text-stone-400"
                  )}
                >
                  {m.title}
                </p>
                <p
                  className={cn(
                    "font-chBody text-[10px]",
                    m.dim ? "text-stone-400" : "text-stone-500"
                  )}
                >
                  {m.sub}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="h-full bg-ch-surface-container-low p-6 lg:col-span-4">
          <h3 className="mb-4 font-chHeadline text-xs font-black uppercase tracking-[0.2em] text-stone-900">
            Governance Controls
          </h3>
          <div className="space-y-px">
            <button
              type="button"
              className="group flex w-full items-center justify-between bg-ch-surface-container-lowest py-2 pl-3 pr-3 font-chBody text-sm font-bold text-stone-900 transition-colors hover:bg-stone-100"
            >
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-stone-400" />
                <span>Invite Second Admin</span>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-300 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              className="group flex w-full items-center justify-between bg-ch-surface-container-lowest py-2 pl-3 pr-3 font-chBody text-sm font-bold text-stone-900 transition-colors hover:bg-stone-100"
            >
              <div className="flex items-center gap-3">
                <PauseCircle className="h-5 w-5 text-stone-400" />
                <span>Suspend Organization</span>
              </div>
              <ChevronRight className="h-5 w-5 text-stone-300 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              className="group flex w-full items-center justify-between bg-ch-surface-container-lowest py-2 pl-3 pr-3 font-chBody text-sm font-bold text-ch-error transition-colors hover:bg-ch-error-container/20"
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
    </main>
  );
}
