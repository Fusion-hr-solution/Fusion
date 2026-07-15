import {
  Users,
  BookOpen,
  TrendingUp,
  ClipboardList,
  GraduationCap,
  CalendarCheck2,
  FileQuestion,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrainingCategory } from "@/types";

/**
 * Mock data for the HR Admin "Learning Overview" screen.
 *
 * Upcoming Sessions are wired to the real admin-sessions-service in the
 * component (`LearningOverview`); these constants back the KPIs, team progress,
 * pending approvals, and completion-by-category sections that have no single
 * clean endpoint yet, plus a fallback when the sessions API is unavailable —
 * matching the app's existing `MOCK_*` convention (see `data/trainings.ts`).
 */

export interface OverviewKpi {
  icon: LucideIcon;
  value: string;
  label: string;
  delta: string;
  /** "up" → green delta pill; "down" → orange (needs-attention) pill. */
  trend: "up" | "down";
}

/** Builds the 4 hero KPIs; the Pending Approvals tile reflects the live list. */
export function buildOverviewKpis(pendingApprovals: number): OverviewKpi[] {
  return [
    { icon: Users, value: "1,284", label: "Total Learners", delta: "+4.2%", trend: "up" },
    { icon: BookOpen, value: "47", label: "Active Trainings", delta: "+3", trend: "up" },
    { icon: TrendingUp, value: "72%", label: "Avg Completion", delta: "+5%", trend: "up" },
    {
      icon: ClipboardList,
      value: String(pendingApprovals),
      label: "Pending Approvals",
      delta: pendingApprovals > 0 ? "4 urgent" : "All clear",
      trend: pendingApprovals > 0 ? "down" : "up",
    },
  ];
}

export type TeamProgressStatus = "on-track" | "completed" | "at-risk";

export interface TeamProgressRow {
  id: string;
  name: string;
  role: string;
  department: string;
  done: number;
  assigned: number;
  completion: number;
  status: TeamProgressStatus;
}

export const MOCK_TEAM_PROGRESS: TeamProgressRow[] = [
  { id: "p1", name: "Sarah Mitchell", role: "Senior Partner", department: "Consulting", done: 5, assigned: 6, completion: 83, status: "on-track" },
  { id: "p2", name: "James Chen", role: "Data Science Lead", department: "Technology", done: 6, assigned: 8, completion: 75, status: "on-track" },
  { id: "p3", name: "Elena Rodriguez", role: "Compliance Director", department: "Risk", done: 5, assigned: 5, completion: 100, status: "completed" },
  { id: "p4", name: "David Park", role: "Executive Coach", department: "People", done: 2, assigned: 4, completion: 50, status: "at-risk" },
  { id: "p5", name: "Anna Kowalski", role: "Senior Manager", department: "Strategy", done: 4, assigned: 7, completion: 57, status: "on-track" },
  { id: "p6", name: "Michael Torres", role: "Cloud Architect", department: "Technology", done: 3, assigned: 9, completion: 33, status: "at-risk" },
];

export const TEAM_TOTAL_LEARNERS = 1284;

export type ApprovalType = "Enrollment" | "Session seat" | "Exam";

export interface PendingApproval {
  id: string;
  name: string;
  training: string;
  type: ApprovalType;
  date: string;
}

export const APPROVAL_TYPE_ICON: Record<ApprovalType, LucideIcon> = {
  Enrollment: GraduationCap,
  "Session seat": CalendarCheck2,
  Exam: FileQuestion,
};

export const MOCK_PENDING_APPROVALS: PendingApproval[] = [
  { id: "a1", name: "Youssef Harrabi", training: "Cloud Architecture on Azure", type: "Enrollment", date: "Mar 20" },
  { id: "a2", name: "Lina Haddad", training: "Financial Modeling & Valuation", type: "Enrollment", date: "Mar 19" },
  { id: "a3", name: "Omar Belkacem", training: "Leadership Bootcamp (On-Site)", type: "Session seat", date: "Mar 18" },
  { id: "a4", name: "Nadia Cherif", training: "AML Compliance — Exam Retake", type: "Exam", date: "Mar 17" },
];

export interface CategoryRate {
  category: TrainingCategory;
  rate: number;
}

export const MOCK_CATEGORY_RATES: CategoryRate[] = [
  { category: "compliance", rate: 88 },
  { category: "soft-skills", rate: 82 },
  { category: "data-analytics", rate: 76 },
  { category: "technical", rate: 71 },
  { category: "leadership", rate: 64 },
  { category: "finance", rate: 59 },
];

export interface UpcomingSession {
  id: string;
  title: string;
  /** ISO start/end so the card can render the date chip + time range locally. */
  startUtc: string;
  endUtc: string;
  room: string;
  instructor: string;
  filled: number;
  capacity: number;
  virtual: boolean;
}

/** Fallback used when the admin-sessions endpoint is unavailable. */
export const MOCK_UPCOMING_SESSIONS: UpcomingSession[] = [
  { id: "s1", title: "Cloud Architecture Workshop", startUtc: "2026-03-24T09:00:00", endUtc: "2026-03-24T12:00:00", room: "Room B-204", instructor: "M. Torres", filled: 18, capacity: 24, virtual: false },
  { id: "s2", title: "Leadership Bootcamp", startUtc: "2026-03-25T14:00:00", endUtc: "2026-03-25T17:00:00", room: "Room A-101", instructor: "S. Mitchell", filled: 22, capacity: 24, virtual: false },
  { id: "s3", title: "AML Compliance Live Q&A", startUtc: "2026-03-26T10:00:00", endUtc: "2026-03-26T11:30:00", room: "Virtual", instructor: "E. Rodriguez", filled: 40, capacity: 50, virtual: true },
  { id: "s4", title: "Workplace Safety Drill", startUtc: "2026-03-27T09:00:00", endUtc: "2026-03-27T12:00:00", room: "Main Hall", instructor: "M. Santos", filled: 30, capacity: 40, virtual: false },
];

/** "Sarah Mitchell" → "SM"; "M. Torres" → "MT". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .replace(/\./g, "")
    .slice(0, 2)
    .toUpperCase();
}
