import {
  BookOpen,
  LayoutDashboard,
  Award,
  Trophy,
  GraduationCap,
  Users,
  BarChart3,
  ClipboardList,
  Settings,
  Route,
  Layers,
  Building2,
  UserCog,
  Grid3X3,
  CalendarClock,
} from "lucide-react";
import type { NavSection } from "@repo/ui";

export const EMPLOYEE_NAV: NavSection = {
  title: "Learning",
  items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Catalog", href: "/", icon: BookOpen },
    { label: "My Trainings", href: "/my-trainings", icon: GraduationCap },
    { label: "Mon Cursus", href: "/cursus", icon: Route },
    { label: "Certificates", href: "/certificates", icon: Award },
    { label: "Badges", href: "/badges", icon: Trophy },
  ],
};

export const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    {
      label: "Manage Trainings",
      href: "/admin/trainings",
      icon: ClipboardList,
    },
    { label: "Employee Progress", href: "/admin/progress", icon: BarChart3 },
    { label: "Assignments", href: "/admin/assignments", icon: Users },
    { label: "Grades", href: "/admin/grades", icon: Layers },
    { label: "Service Lines", href: "/admin/service-lines", icon: Building2 },
    { label: "Employee Profiles", href: "/admin/employee-profiles", icon: UserCog },
    { label: "Curriculum", href: "/admin/curriculum", icon: Grid3X3 },
    { label: "Sessions", href: "/admin/sessions", icon: CalendarClock },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};
