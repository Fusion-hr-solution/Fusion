import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Handshake,
  UsersRound,
  Video,
} from "lucide-react";
import type { ShellModule } from "./types";

/**
 * The full set of Fusion platform modules for the sidebar module switcher.
 * Mirrors @repo/ui's DEFAULT_MODULES so Core/Performance show the same cross-module
 * navigation the other apps do. Cross-module links are full-page navigations (separate apps).
 */
export const FUSION_MODULES: ShellModule[] = [
  { key: "core", label: "Core HR", description: "Workforce & organization", icon: BrainCircuit, href: "/core" },
  { key: "learning", label: "Learning", description: "Training & onboarding", icon: BookOpen, href: "/learning" },
  { key: "performance", label: "Performance", description: "Workspace", icon: BarChart3, href: "/performance" },
  { key: "recruitment", label: "Recruitment", description: "Hiring pipeline", icon: UsersRound, href: "/recruitment" },
  { key: "onboarding", label: "Onboarding", description: "New-hire journeys", icon: Handshake, href: "/onboarding" },
  { key: "interview", label: "Interview", description: "Candidate assessments", icon: Video, href: "/interview" },
];

/**
 * Modules whose visibility this feature governs through tenant entitlements.
 * The remaining modules are owned by other teams and are deliberately untouched:
 * they are not provisionable here, so filtering them would hide navigation on
 * data this feature does not own.
 */
const ENTITLEMENT_GOVERNED_MODULES: Record<string, string> = {
  core: "CoreHR",
  performance: "Performance",
};

/**
 * Hides Core HR and Performance when the tenant has no entitlement for them.
 *
 * This is visibility only. It removes a door the user cannot open, so the
 * navigation tells the truth; the backend boundary is what actually refuses the
 * request, and direct entry is gated separately.
 */
export function filterModulesByEntitlement(
  modules: ShellModule[],
  moduleEntitlements: readonly string[],
): ShellModule[] {
  return modules.filter((module) => {
    const required = ENTITLEMENT_GOVERNED_MODULES[module.key];
    return required === undefined || moduleEntitlements.includes(required);
  });
}
