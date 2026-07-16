"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  Compass,
  Megaphone,
  ScrollText,
  Settings2,
  Target,
  UserRoundCheck,
} from "lucide-react";
import {
  canAccessMyObjectives,
  canAccessPlanApprovals,
  canAccessTeamObjectives,
  canViewObjectivePlanningConfiguration,
  canViewPerformanceCampaigns,
  canViewPerformanceStrategy,
  hasAnyRole,
  PLATFORM_ADMIN_ROLE,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { cn } from "@/lib/utils";

type WorkDoor = {
  title: string;
  description: string;
  href: string;
  icon: typeof Megaphone;
  emphasis?: "primary" | "warning";
};

export default function PerformancePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading rows={4} label="Loading Performance workspace" />
      </PageContainer>
    );
  }

  const isPlatformAdmin = hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
  const doors: WorkDoor[] = [
    canAccessMyObjectives(user)
      ? {
          title: "My objectives",
          description: "Create, correct, submit, or review your own objective plan.",
          href: "/my-objectives",
          icon: UserRoundCheck,
          emphasis: "primary",
        }
      : null,
    canAccessTeamObjectives(user)
      ? {
          title: "Team objectives",
          description: "Define the team-level objectives employees can align to.",
          href: "/team-objectives",
          icon: Target,
        }
      : null,
    canAccessPlanApprovals(user)
      ? {
          title: "Plan approvals",
          description: "Review submitted plans, request changes, or approve.",
          href: "/plan-approvals",
          icon: ClipboardCheck,
          emphasis: "warning",
        }
      : null,
    canViewPerformanceStrategy(user)
      ? {
          title: "Strategy",
          description: "Check campaign strategy coverage and cascade visibility.",
          href: "/strategy",
          icon: Compass,
        }
      : null,
    canViewPerformanceCampaigns(user)
      ? {
          title: "Campaigns",
          description: "Set up, launch, monitor, and lock objective planning campaigns.",
          href: "/campaigns",
          icon: Megaphone,
        }
      : null,
    canViewObjectivePlanningConfiguration(user)
      ? {
          title: "Objective planning rules",
          description: "Review tenant planning limits, weights, and measurement methods.",
          href: "/configuration/planning",
          icon: ScrollText,
        }
      : null,
    isPlatformAdmin
      ? {
          title: "Platform configuration",
          description: "Maintain platform defaults and supported planning guardrails.",
          href: "/platform/configuration/performance",
          icon: Settings2,
        }
      : null,
  ].filter(Boolean) as WorkDoor[];

  return (
    <PageContainer>
      <PageHeader
        title="Performance"
        description="Objective planning workspaces for the roles assigned to your account."
      />

      {doors.length === 0 ? (
        <PagePermissionNotice title="Performance access required" />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {doors.map((door) => (
            <PerformanceDoor key={door.href} door={door} />
          ))}
        </section>
      )}
    </PageContainer>
  );
}

function PerformanceDoor({ door }: { door: WorkDoor }) {
  const Icon = door.icon;
  return (
    <Link
      href={door.href}
      className={cn(
        "group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        door.emphasis === "primary" && "border-primary/30",
        door.emphasis === "warning" && "border-amber-500/35",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-foreground">{door.title}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{door.description}</span>
        </span>
      </div>
      <span className="mt-5 text-sm font-medium text-primary">Open workspace</span>
    </Link>
  );
}
