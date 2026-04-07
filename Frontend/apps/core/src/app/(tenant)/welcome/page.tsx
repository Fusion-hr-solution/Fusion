"use client";

import {
  ArrowRight,
  CheckCircle,
  Settings,
  Users,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@repo/auth";

function getShellOrigin(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_SHELL_ORIGIN || window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SHELL_ORIGIN || "http://localhost:3000";
}

export default function WelcomePage() {
  const { user } = useAuth();
  const shellOrigin = getShellOrigin();

  const firstName = user?.fullName?.split(" ")[0] || "Admin";
  const isPlatformAdmin = user?.roles?.includes("PlatformAdmin");
  const isHRAdmin = user?.roles?.includes("HRAdmin");

  // For HRAdmin, link to employees (their accessible area)
  // For PlatformAdmin, link to dashboard
  const dashboardLink = isHRAdmin && !isPlatformAdmin 
    ? `${shellOrigin}/core/employees`
    : shellOrigin;
  const dashboardLabel = isHRAdmin && !isPlatformAdmin
    ? "Go to Employees"
    : "Go to Dashboard";

  return (
    <div className="min-h-screen bg-ch-surface font-chBody text-ch-on-surface">
      {/* Header */}
      <header className="border-b border-ch-outline-variant/20 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tighter text-ch-on-surface">
                EY
              </span>
              <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-ch-on-surface">
                Building a better working world
              </span>
            </div>
            <div className="mx-4 h-6 w-px bg-ch-surface-container-highest" />
            <span className="font-chHeadline text-base font-bold uppercase tracking-widest text-ch-on-surface-variant">
              Fusion
            </span>
          </div>
          <a
            href={dashboardLink}
            className="text-sm font-medium text-ch-primary hover:underline"
          >
            {dashboardLabel}
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="px-6 py-12">
        <div className="mx-auto max-w-5xl">
          {/* Welcome banner */}
          <div className="mb-10 rounded-ch-lg border border-ch-outline-variant/20 bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ch-tertiary-container">
                <Sparkles className="h-6 w-6 text-ch-on-tertiary-container" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ch-tertiary">
                  Welcome to Fusion
                </p>
              </div>
            </div>
            <h1 className="mb-3 font-chHeadline text-3xl font-extrabold leading-tight tracking-tight text-ch-on-surface">
              Welcome, {firstName}!
            </h1>
            <p className="mb-4 max-w-2xl text-[0.9375rem] leading-relaxed text-ch-on-surface-variant">
              Your organization is now active. As the primary HR Administrator,
              you have full access to manage your team, configure settings, and
              start onboarding employees.
            </p>
            <div className="flex items-center gap-2 rounded-ch-md bg-ch-tertiary-container/30 px-4 py-2.5">
              <CheckCircle className="h-5 w-5 text-ch-tertiary" />
              <span className="text-sm font-medium text-ch-on-surface">
                Organization activated successfully
              </span>
            </div>
          </div>

          {/* Next steps checklist */}
          <div className="mb-10">
            <h2 className="mb-5 font-chHeadline text-xl font-bold text-ch-on-surface">
              Get started
            </h2>
            <div className="space-y-3">
              <NextStepCard
                icon={<Users className="h-5 w-5" />}
                title="Explore employee management"
                description="View and manage your organization's employee directory."
                href={`${shellOrigin}/core/employees`}
                ctaLabel="Go to Employees"
              />
              <NextStepCard
                icon={<Settings className="h-5 w-5" />}
                title="Configure settings"
                description="Customize employee fields, branding, and organization preferences."
                href={`${shellOrigin}/core/settings`}
                ctaLabel="Open Settings"
                disabled
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-ch-lg border border-ch-outline-variant/20 bg-white p-6">
              <h3 className="mb-3 font-chHeadline text-lg font-bold text-ch-on-surface">
                Quick actions
              </h3>
              <div className="space-y-2">
                <a
                  href={`${shellOrigin}/core/employees`}
                  className="flex items-center justify-between rounded-ch-md bg-ch-surface-container-low px-4 py-3 text-sm font-medium text-ch-on-surface transition-colors hover:bg-ch-surface-container-high"
                >
                  View Employee Directory
                  <ArrowRight className="h-4 w-4 text-ch-secondary" />
                </a>
              </div>
            </div>

            <div className="rounded-ch-lg border border-ch-outline-variant/20 bg-white p-6">
              <h3 className="mb-3 font-chHeadline text-lg font-bold text-ch-on-surface">
                Need help?
              </h3>
              <p className="mb-4 text-sm text-ch-on-surface-variant">
                Our support team is here to help you get started.
              </p>
              <p className="text-xs text-ch-on-surface-variant">
                Contact your system administrator for assistance.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NextStepCard({
  icon,
  title,
  description,
  href,
  ctaLabel,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  disabled?: boolean;
}) {
  const content = (
    <div className="flex items-start gap-4 rounded-ch-lg border border-ch-outline-variant/20 bg-white p-5 transition-colors hover:border-ch-primary/30 hover:bg-ch-surface-container-lowest">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ch-md bg-ch-surface-container-low text-ch-on-surface-variant">
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="mb-1 font-chHeadline text-base font-bold text-ch-on-surface">
          {title}
        </h4>
        <p className="mb-3 text-sm text-ch-on-surface-variant">{description}</p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ch-primary">
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div className="cursor-not-allowed opacity-50" title="Coming soon">
        {content}
      </div>
    );
  }

  return <a href={href}>{content}</a>;
}
