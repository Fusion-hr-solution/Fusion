"use client";

import { useMemo, useState } from "react";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  BarChart3,
  Shield,
  CircleDashed,
  Play,
} from "lucide-react";
import {
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Input,
} from "@repo/ui";
import type {
  Employee,
  Training,
  TrainingCategory,
  TrainingStatus,
} from "@/types";
import { CATEGORY_CONFIG } from "@/data/categories";

/* ── Helpers ── */

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
}

function statusLabel(s: TrainingStatus): string {
  return s === "in-progress"
    ? "In Progress"
    : s === "completed"
      ? "Completed"
      : "Not Started";
}

const STATUS_COLORS: Record<TrainingStatus, string> = {
  "in-progress":
    "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))] border-[hsl(var(--ey-blue-400))]/25",
  completed:
    "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))] border-[hsl(var(--ey-green-500))]/25",
  "not-started":
    "bg-[hsl(var(--ey-grey-200))] text-[hsl(var(--ey-grey-400))] border-[hsl(var(--ey-grey-300))]/25",
};

const STATUS_ICONS: Record<TrainingStatus, typeof Play> = {
  "in-progress": Play,
  completed: CheckCircle2,
  "not-started": CircleDashed,
};

const AVATAR_COLORS = [
  "bg-[hsl(var(--ey-blue-500))]",
  "bg-[hsl(var(--ey-teal-500))]",
  "bg-[hsl(var(--ey-orange-500))]",
  "bg-purple-600",
  "bg-[hsl(var(--ey-green-500))]",
  "bg-[hsl(var(--ey-red-500))]",
  "bg-[hsl(var(--ey-blue-600))]",
  "bg-amber-600",
];

/* ── Props ── */

interface AdminDashboardProps {
  employees: Employee[];
  trainings: Training[];
}

export function AdminDashboard({ employees, trainings: _trainings }: AdminDashboardProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | "all">(
    "all"
  );
  const [deptFilter, setDeptFilter] = useState<string>("all");

  /* Aggregate stats */
  const stats = useMemo(() => {
    const allRecords = employees.flatMap((e) => e.trainings);
    const completed = allRecords.filter((r) => r.status === "completed").length;
    const inProgress = allRecords.filter(
      (r) => r.status === "in-progress"
    ).length;
    const notStarted = allRecords.filter(
      (r) => r.status === "not-started"
    ).length;
    const overdue = allRecords.filter((r) => {
      if (!r.deadline || r.status === "completed") return false;
      return new Date(r.deadline) < new Date();
    }).length;
    const avgCompletion =
      allRecords.length > 0
        ? Math.round(
            allRecords.reduce((sum, r) => sum + r.progress, 0) /
              allRecords.length
          )
        : 0;

    return {
      totalEmployees: employees.length,
      totalEnrollments: allRecords.length,
      completed,
      inProgress,
      notStarted,
      overdue,
      avgCompletion,
    };
  }, [employees]);

  /* Departments */
  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department));
    return ["all", ...Array.from(depts).sort()];
  }, [employees]);

  /* Category popularity */
  const categoryStats = useMemo(() => {
    const map = new Map<TrainingCategory, { total: number; completed: number }>();
    for (const emp of employees) {
      for (const t of emp.trainings) {
        const existing = map.get(t.category) ?? { total: 0, completed: 0 };
        existing.total++;
        if (t.status === "completed") existing.completed++;
        map.set(t.category, existing);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([category, data]) => ({
        category,
        ...data,
        rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }));
  }, [employees]);

  /* Training performance */
  const trainingPerformance = useMemo(() => {
    const map = new Map<
      string,
      { title: string; enrolled: number; completed: number; avgProgress: number; totalProgress: number }
    >();
    for (const emp of employees) {
      for (const t of emp.trainings) {
        const existing = map.get(t.trainingId) ?? {
          title: t.trainingTitle,
          enrolled: 0,
          completed: 0,
          avgProgress: 0,
          totalProgress: 0,
        };
        existing.enrolled++;
        existing.totalProgress += t.progress;
        if (t.status === "completed") existing.completed++;
        map.set(t.trainingId, existing);
      }
    }
    return Array.from(map.values())
      .map((t) => ({
        ...t,
        avgProgress: Math.round(t.totalProgress / t.enrolled),
        completionRate: Math.round((t.completed / t.enrolled) * 100),
      }))
      .sort((a, b) => b.enrolled - a.enrolled);
  }, [employees]);

  /* Filtered employees */
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (deptFilter !== "all") {
      result = result.filter((e) => e.department === deptFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((e) =>
        e.trainings.some((t) => t.status === statusFilter)
      );
    }

    return result;
  }, [employees, search, deptFilter, statusFilter]);

  return (
    <TooltipProvider delayDuration={200}>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/50 bg-white">
        <div className="ey-hero-pattern absolute inset-0 opacity-30" />
        <div className="absolute left-0 bottom-0 h-1/2 w-1/3 bg-gradient-to-tr from-[hsl(var(--ey-black))]/3 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 py-10 lg:py-12">
          <div className="ey-animate-fade-up flex items-end gap-3 mb-1">
            <div className="flex h-9 w-1 rounded-full ey-bg-dark-deep" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Administration
            </span>
          </div>

          <h1
            className="ey-animate-fade-up mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl"
            style={{ animationDelay: "80ms" }}
          >
            Employee Training Overview
          </h1>
          <p
            className="ey-animate-fade-up mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            Monitor team progress, identify gaps, and ensure compliance across
            all training programs.
          </p>

          {/* ── KPI strip ── */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            {[
              {
                icon: Users,
                value: stats.totalEmployees,
                label: "Employees",
                accent: "bg-[hsl(var(--ey-black))]/6",
                iconColor: "text-[hsl(var(--ey-grey-500))]",
              },
              {
                icon: BookOpen,
                value: stats.totalEnrollments,
                label: "Enrollments",
                accent: "bg-[hsl(var(--ey-blue-400))]/8",
                iconColor: "text-[hsl(var(--ey-blue-400))]",
              },
              {
                icon: CheckCircle2,
                value: stats.completed,
                label: "Completed",
                accent: "bg-[hsl(var(--ey-green-500))]/8",
                iconColor: "text-[hsl(var(--ey-green-500))]",
              },
              {
                icon: TrendingUp,
                value: `${stats.avgCompletion}%`,
                label: "Avg. Progress",
                accent: "bg-[hsl(var(--ey-yellow))]/10",
                iconColor: "ey-text-accent",
              },
              {
                icon: AlertTriangle,
                value: stats.overdue,
                label: "Overdue",
                accent:
                  stats.overdue > 0
                    ? "bg-[hsl(var(--ey-red-500))]/8"
                    : "bg-[hsl(var(--ey-grey-100))]",
                iconColor:
                  stats.overdue > 0
                    ? "text-[hsl(var(--ey-red-500))]"
                    : "text-[hsl(var(--ey-grey-400))]",
              },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="ey-animate-fade-up group flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  style={{ animationDelay: `${240 + i * 50}ms` }}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.accent} transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 ${kpi.iconColor}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none tabular-nums">
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {kpi.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT (2/3): Employee table ── */}
          <div className="space-y-5 lg:col-span-2">
            {/* Filters */}
            <div
              className="ey-animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ animationDelay: "60ms" }}
            >
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm border-border/60 bg-white focus-visible:ring-[hsl(var(--ey-yellow))]/40"
                />
              </div>

              <div className="flex gap-2">
                {/* Department filter */}
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-9 rounded-lg border border-border/60 bg-white px-3 text-xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--ey-grey-50))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ey-yellow))]/40"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === "all" ? "All Departments" : d}
                    </option>
                  ))}
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as TrainingStatus | "all"
                    )
                  }
                  className="h-9 rounded-lg border border-border/60 bg-white px-3 text-xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--ey-grey-50))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ey-yellow))]/40"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in-progress">In Progress</option>
                  <option value="not-started">Not Started</option>
                </select>
              </div>
            </div>

            {/* Employee list */}
            <div className="ey-stagger-list space-y-3">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee, idx) => (
                  <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    colorIndex={idx}
                    expanded={expandedId === employee.id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === employee.id ? null : employee.id
                      )
                    }
                    statusFilter={statusFilter}
                  />
                ))
              ) : (
                <div className="ey-animate-scale-in flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-white py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-100))] mb-3">
                    <Users
                      className="h-5 w-5 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    No employees match your filters
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT (1/3): Insights ── */}
          <div className="space-y-6">
            {/* Completion funnel */}
            <div
              className="ey-animate-fade-up"
              style={{ animationDelay: "100ms" }}
            >
              <CompletionFunnel
                completed={stats.completed}
                inProgress={stats.inProgress}
                notStarted={stats.notStarted}
                total={stats.totalEnrollments}
              />
            </div>

            {/* Category performance */}
            <div
              className="ey-animate-fade-up"
              style={{ animationDelay: "200ms" }}
            >
              <CategoryPerformance items={categoryStats} />
            </div>

            {/* Top trainings */}
            <div
              className="ey-animate-fade-up"
              style={{ animationDelay: "300ms" }}
            >
              <TopTrainings items={trainingPerformance.slice(0, 5)} />
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}

/* ─────────────────────────── Employee Row ─────────────────────────── */

function EmployeeRow({
  employee,
  colorIndex,
  expanded,
  onToggle,
  statusFilter,
}: {
  employee: Employee;
  colorIndex: number;
  expanded: boolean;
  onToggle: () => void;
  statusFilter: TrainingStatus | "all";
}) {
  const completed = employee.trainings.filter(
    (t) => t.status === "completed"
  ).length;
  const total = employee.trainings.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avatarColor = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]!;

  const filteredTrainings =
    statusFilter === "all"
      ? employee.trainings
      : employee.trainings.filter((t) => t.status === statusFilter);

  const overdue = employee.trainings.filter((t) => {
    if (!t.deadline || t.status === "completed") return false;
    return new Date(t.deadline) < new Date();
  });

  return (
    <Card
      className={`group overflow-hidden border transition-all duration-300 ${
        expanded
          ? "border-[hsl(var(--ey-grey-300))] shadow-lg shadow-black/5"
          : "border-border/60 hover:shadow-md hover:shadow-black/4 hover:border-[hsl(var(--ey-grey-300))]"
      } bg-white`}
    >
      {/* Header row */}
      <button
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-[hsl(var(--ey-grey-50))]/50"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} details for ${employee.name}`}
      >
        {/* Avatar */}
        <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
          <AvatarFallback
            className={`${avatarColor} text-white text-xs font-bold`}
          >
            {initials(employee.name)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {employee.name}
            </p>
            {overdue.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex h-5 items-center gap-1 rounded-full bg-[hsl(var(--ey-red-500))]/10 px-2 text-[10px] font-bold text-[hsl(var(--ey-red-500))]">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {overdue.length}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {overdue.length} overdue{" "}
                  {overdue.length === 1 ? "training" : "trainings"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {employee.role} · {employee.department}
          </p>
        </div>

        {/* Mini progress */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-bold text-foreground tabular-nums">
              {completed}/{total}
            </span>
            <div className="h-1.5 w-20 rounded-full bg-[hsl(var(--ey-grey-200))] overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--ey-green-500))] transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-grey-50))] text-muted-foreground transition-transform duration-200">
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </div>
      </button>

      {/* Expanded training list */}
      {expanded && (
        <div className="ey-animate-fade-up border-t border-border/40">
          <div className="px-4 py-3 space-y-2">
            {filteredTrainings.map((training) => {
              const catConfig = CATEGORY_CONFIG[training.category];
              const Icon = STATUS_ICONS[training.status];
              const isOverdue =
                training.deadline &&
                training.status !== "completed" &&
                new Date(training.deadline) < new Date();

              return (
                <div
                  key={training.trainingId}
                  className="flex items-center gap-3 rounded-lg bg-[hsl(var(--ey-grey-50))] px-3.5 py-2.5 transition-colors hover:bg-[hsl(var(--ey-grey-100))]"
                >
                  {/* Category strip dot */}
                  <div
                    className={`h-8 w-1 rounded-full ${catConfig?.stripClass ?? "bg-[hsl(var(--ey-grey-300))]"}`}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {training.trainingTitle}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[training.status]}`}
                      >
                        <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                        {statusLabel(training.status)}
                      </span>
                      {catConfig && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${catConfig.badgeClass}`}
                        >
                          {catConfig.label}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ey-red-500))]/10 px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--ey-red-500))]">
                          <AlertTriangle
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                          />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-9 w-9 items-center justify-center">
                      <svg
                        className="h-9 w-9 -rotate-90"
                        viewBox="0 0 36 36"
                      >
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="hsl(var(--ey-grey-200))"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={
                            training.status === "completed"
                              ? "hsl(var(--ey-green-500))"
                              : "hsl(var(--ey-blue-400))"
                          }
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={`${(training.progress / 100) * 94.2} 94.2`}
                        />
                      </svg>
                      <span className="absolute text-[9px] font-bold text-foreground tabular-nums">
                        {training.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTrainings.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No trainings match the selected status filter.
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────── Completion Funnel ─────────────────────────── */

function CompletionFunnel({
  completed,
  inProgress,
  notStarted,
  total,
}: {
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
}) {
  const segments = [
    {
      label: "Completed",
      value: completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      color: "bg-[hsl(var(--ey-green-500))]",
      dotColor: "bg-[hsl(var(--ey-green-500))]",
    },
    {
      label: "In Progress",
      value: inProgress,
      pct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      color: "bg-[hsl(var(--ey-blue-400))]",
      dotColor: "bg-[hsl(var(--ey-blue-400))]",
    },
    {
      label: "Not Started",
      value: notStarted,
      pct: total > 0 ? Math.round((notStarted / total) * 100) : 0,
      color: "bg-[hsl(var(--ey-grey-300))]",
      dotColor: "bg-[hsl(var(--ey-grey-300))]",
    },
  ];

  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <div className="h-1 w-full ey-bg-dark-deep ey-animate-stripe" />
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-black))]/8">
            <Shield
              className="h-3.5 w-3.5 text-[hsl(var(--ey-grey-500))]"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Completion Funnel
          </h3>
        </div>

        {/* Stacked bar */}
        <div className="h-4 flex rounded-full overflow-hidden bg-[hsl(var(--ey-grey-200))] mb-5">
          {segments.map(
            (seg) =>
              seg.pct > 0 && (
                <Tooltip key={seg.label}>
                  <TooltipTrigger asChild>
                    <div
                      className={`${seg.color} transition-all duration-700 ease-out`}
                      style={{ width: `${seg.pct}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {seg.label}: {seg.value} ({seg.pct}%)
                  </TooltipContent>
                </Tooltip>
              )
          )}
        </div>

        {/* Legend */}
        <div className="space-y-2.5">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${seg.dotColor}`}
                />
                <span className="text-muted-foreground">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground tabular-nums">
                  {seg.value}
                </span>
                <span className="text-muted-foreground tabular-nums w-8 text-right">
                  {seg.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Category Performance ─────────────────────────── */

function CategoryPerformance({
  items,
}: {
  items: {
    category: TrainingCategory;
    total: number;
    completed: number;
    rate: number;
  }[];
}) {
  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
            <BarChart3
              className="h-3.5 w-3.5 text-purple-500"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Category Completion Rates
          </h3>
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const config = CATEGORY_CONFIG[item.category];
            if (!config) return null;
            return (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${config.badgeClass}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span className="font-bold text-foreground">
                      {item.rate}%
                    </span>{" "}
                    ({item.completed}/{item.total})
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[hsl(var(--ey-grey-200))] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${config.stripClass} transition-all duration-700 ease-out`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Top Trainings ─────────────────────────── */

function TopTrainings({
  items,
}: {
  items: {
    title: string;
    enrolled: number;
    completed: number;
    avgProgress: number;
    completionRate: number;
  }[];
}) {
  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
            <TrendingUp
              className="h-3.5 w-3.5 ey-text-accent"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Most Enrolled Trainings
          </h3>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[hsl(var(--ey-grey-50))]"
            >
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ey-bg-dark text-[10px] font-bold text-white mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
                  {item.title}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {item.enrolled} enrolled
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {item.completionRate}% done
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-[hsl(var(--ey-grey-200))] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--ey-green-500))] transition-all duration-500"
                    style={{ width: `${item.completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
