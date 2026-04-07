import type { SidebarModule } from "@repo/ui";
import {
  BarChart2,
  BookOpen,
  BrainCircuit,
  Handshake,
  Users,
  Video,
} from "lucide-react";

/**
 * Platform modules for the shell switcher — hrefs are absolute from the app origin
 * (same contract as @repo/ui ModuleSwitcher defaults).
 */
export const PLATFORM_MODULES: SidebarModule[] = [
  /** Path is relative to this Next app’s `basePath` (`/core`) — use `/` for module home */
  { label: "Core", href: "/", icon: BrainCircuit },
  { label: "Learning", href: "/learning", icon: BookOpen },
  { label: "Performance", href: "/performance", icon: BarChart2 },
  { label: "Recruitment", href: "/recruitment", icon: Users },
  { label: "Onboarding", href: "/onboarding", icon: Handshake },
  { label: "Interview", href: "/interview", icon: Video },
];
