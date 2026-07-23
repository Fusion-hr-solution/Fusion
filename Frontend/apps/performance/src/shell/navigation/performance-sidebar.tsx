"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import {
  canAccessMyEvaluations,
  canAccessTeamEvaluations,
  canSeeOwnCoreProfileNavigation,
  useAuth,
} from "@repo/auth";
import { createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import type { EvaluationWorkEntryDto } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import type { ShellNavSection } from "@repo/ds/shell";
import {
  OVERVIEW_NAV,
  buildConfigurationSection,
  getPerformanceDoorsByGroup,
} from "@/data/sidebar-nav";

const performanceApi = createPlatformApiClient();

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const canSeeOwnProfile = canSeeOwnCoreProfileNavigation(user);
  const myEvaluations = useApiQuery<EvaluationWorkEntryDto[]>(
    performanceQueryKeys.myEvaluationAssignments(),
    (signal) => performanceApi.get(performancePaths.myEvaluationAssignments(), { signal }),
    { enabled: canAccessMyEvaluations(user) },
  );
  const teamEvaluations = useApiQuery<EvaluationWorkEntryDto[]>(
    performanceQueryKeys.teamEvaluationAssignments(),
    (signal) => performanceApi.get(performancePaths.teamEvaluationAssignments(), { signal }),
    { enabled: canAccessTeamEvaluations(user) },
  );
  const hasAssignments = (href: string | undefined) => {
    if (href === "/my-evaluations") return (myEvaluations.data?.length ?? 0) > 0;
    if (href === "/team-evaluations") return (teamEvaluations.data?.length ?? 0) > 0;
    return true;
  };
  const grouped = getPerformanceDoorsByGroup(user);
  const workDoors = grouped.work.filter((door) => hasAssignments(door.section.items[0]?.href));
  const configurationSection = buildConfigurationSection(grouped.configuration);

  const sections: ShellNavSection[] = [
    OVERVIEW_NAV,
    ...workDoors.map((door) => door.section),
    ...(configurationSection ? [configurationSection] : []),
    ...grouped.platform.map((door) => door.section),
  ];

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Performance workspace"
      brandIcon={BarChart3}
      activePath={activePath}
      pending={isAuthLoading || myEvaluations.isLoading || teamEvaluations.isLoading}
      sections={sections}
      modules={FUSION_MODULES}
      currentModuleKey="performance"
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          pending={isAuthLoading}
          name={user?.fullName}
          secondaryLabel={user?.roles?.[0]}
          links={[
            // Raw anchors → include basePath explicitly. Core owns the employee
            // profile surface; Performance has no profile route of its own.
            ...(canSeeOwnProfile
              ? [{ label: "My profile", href: "/core/profile", icon: User }]
              : []),
            { label: "Platform home", href: "/", icon: Home },
          ]}
          onSignOut={async () => {
            await logout();
            window.location.href = "/auth/signin";
          }}
        />
      )}
    />
  );
}
