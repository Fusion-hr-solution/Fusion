"use client";

import { useFieldVisibility } from "@repo/api/query";
import { canAccessCoreOrgChart, canAccessCoreTeam, canSeeCoreOrgChart, useAuth } from "@repo/auth";

/**
 * Whether the org chart is open to the viewer under the tenant's audience (Core HR settings › Employee fields). Managers
 * and people who read the whole workforce always see it; everyone else waits for the field policy, which every member
 * may read. Core HR enforces the same rule, so this only hides what would lead to a refusal.
 */
export function useOrgChartAccess(): { canSee: boolean; isLoading: boolean; narrowed: boolean } {
  const { user, isLoading: authLoading } = useAuth();
  const needsPolicy = canAccessCoreOrgChart(user) && !canAccessCoreTeam(user);
  const policy = useFieldVisibility({ enabled: !authLoading && needsPolicy });
  const canSee = canSeeCoreOrgChart(user, needsPolicy ? policy.data?.orgChart?.audience : "Everyone");
  return {
    canSee,
    isLoading: authLoading || (needsPolicy && policy.isLoading),
    // The role includes the chart but the company keeps it to managers and HR.
    narrowed: needsPolicy && !canSee && policy.data !== undefined,
  };
}
