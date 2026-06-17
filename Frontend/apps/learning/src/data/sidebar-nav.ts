import {
  BookOpen,
  LayoutDashboard,
  Award,
  Trophy,
  GraduationCap,
  Users,
  BarChart3,
  BarChart2,
  ClipboardList,
  Settings,
  Route,
  Layers,
  Building2,
  UserCog,
  Grid3X3,
  CalendarClock,
  CalendarCheck2,
  ScanLine,
  BadgeCheck,
} from "lucide-react";
import type { NavSection } from "@repo/ui";

/**
 * `title`, `label`, and `disabledReason` hold translation keys resolved
 * against the `nav` namespace in `messages/{locale}.json` (see
 * `LearningSidebar`), not display strings.
 */
export const EMPLOYEE_NAV: NavSection = {
  title: "learning",
  items: [
    { label: "dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "catalog", href: "/", icon: BookOpen },
    { label: "myTrainings", href: "/my-trainings", icon: GraduationCap },
    { label: "mySessions", href: "/my-sessions", icon: CalendarCheck2 },
    { label: "scanQr", href: "/my-sessions/scan", icon: ScanLine },
    { label: "cursus", href: "/cursus", icon: Route },
    { label: "certificates", href: "/certificates", icon: Award },
    {
      label: "badges",
      href: "/badges",
      icon: Trophy,
      disabled: true,
      disabledReason: "comingSoon",
    },
  ],
};

export const ADMIN_NAV: NavSection = {
  title: "administration",
  items: [
    { label: "dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    {
      label: "manageTrainings",
      href: "/admin/trainings",
      icon: ClipboardList,
    },
    { label: "employeeProgress", href: "/admin/progress", icon: BarChart3 },
    { label: "assignments", href: "/admin/assignments", icon: Users },
    { label: "grades", href: "/admin/grades", icon: Layers },
    { label: "serviceLines", href: "/admin/service-lines", icon: Building2 },
    {
      label: "employeeProfiles",
      href: "/admin/employee-profiles",
      icon: UserCog,
    },
    { label: "curriculum", href: "/admin/curriculum", icon: Grid3X3 },
    { label: "sessions", href: "/admin/sessions", icon: CalendarClock },
    { label: "attendance", href: "/admin/attendance", icon: BarChart2 },
    {
      label: "certificateRegistry",
      href: "/admin/certificates",
      icon: BadgeCheck,
    },
    { label: "settings", href: "/admin/settings", icon: Settings },
  ],
};
