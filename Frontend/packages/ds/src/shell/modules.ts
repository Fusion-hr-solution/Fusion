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
