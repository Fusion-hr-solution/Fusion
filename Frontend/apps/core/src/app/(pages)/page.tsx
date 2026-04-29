"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building,
  ClipboardList,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  canSeeCoreSetupNavigation,
  canSeeOrganizationsNavigation,
  useAuth,
} from "@repo/auth";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canSeeEmployeeRosterNavigation } from "@/lib/employee-roster-access";

interface WorkspaceArea {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading && !user) {
    return (
      <CorePageLoadingState
        title="Core workspace"
        description="Use Dashboard as the operational summary for the Core workspaces that are live today."
        message="Loading dashboard..."
        variant="dashboard"
      />
    );
  }

  const workspaceAreas: WorkspaceArea[] = [
    {
      title: "Setup",
      description:
        "Tenant structure, draft workspace progress, and publish readiness.",
      href: "/setup",
      icon: ClipboardList,
      available: canSeeCoreSetupNavigation(user),
    },
    {
      title: "Organizations",
      description: "Tenant organization records and lifecycle administration.",
      href: "/organizations",
      icon: Building,
      available: canSeeOrganizationsNavigation(user),
    },
    {
      title: "Employees",
      description:
        "Roster operations, import workflow, and employee history surfaces.",
      href: "/employees",
      icon: Users,
      available: canSeeEmployeeRosterNavigation(user),
    },
  ];
  const availableAreas = workspaceAreas.filter((area) => area.available);

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Core workspace"
        description="Use Dashboard as the operational summary for the Core workspaces that are live today."
      />

      <Card className="py-0">
        <CardContent className="grid gap-6  p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col gap-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <LayoutDashboard className="size-3.5" />
                Operational focus
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Core is intentionally centered on setup, organizations, and
                  employee operations.
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Navigation stays narrow on purpose. Placeholder areas stay out
                  of the primary path until they have real workflows and backend
                  support behind them.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 ">
              {workspaceAreas.map((area) => {
                const Icon = area.icon;

                return (
                  <div
                    key={area.href}
                    className="flex h-full flex-col rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </div>
                        <p className="font-medium">{area.title}</p>
                      </div>
                      <Badge variant={area.available ? "secondary" : "outline"}>
                        {area.available ? "Available" : "Role-gated"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {area.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="border-dashed bg-muted/10 shadow-none">
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>
                Launch the live Core workspaces available to your current role.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {availableAreas.length > 0 ? (
                availableAreas.map((area) => {
                  const Icon = area.icon;

                  return (
                    <Link
                      key={area.href}
                      href={area.href}
                      className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {area.title}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {area.description}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                  Your current role does not expose any primary Core workflows
                  from Dashboard.
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
