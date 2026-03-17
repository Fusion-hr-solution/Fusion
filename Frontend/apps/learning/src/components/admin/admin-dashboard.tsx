"use client";

import { useMemo, useState } from "react";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  BookOpen,
} from "lucide-react";
import { TooltipProvider, Input } from "@repo/ui";
import type { Employee, Training, TrainingCategory, TrainingStatus } from "@/types";
import { EmployeeRow } from "./employee-row";
import { CompletionFunnel } from "./completion-funnel";
import { CategoryPerformance } from "./category-performance";
import { TopTrainings } from "./top-trainings";

interface AdminDashboardProps {
  employees: Employee[];
  trainings: Training[];
}

export function AdminDashboard({ employees, trainings: _trainings }: AdminDashboardProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | "all">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  /* Aggregate stats */
  const stats = useMemo(() => {
    const allRecords = employees.flatMap((e) => e.trainings);
    const completed = allRecords.filter((r) => r.status === "completed").length;
    const inProgress = allRecords.filter((r) => r.status === "in-progress").length;
    const notStarted = allRecords.filter((r) => r.status === "not-started").length;
    const overdue = allRecords.filter((r) => {
      if (!r.deadline || r.status === "completed") return false;
      return new Date(r.deadline) < new Date();
    }).length;
    const avgCompletion =
      allRecords.length > 0
        ? Math.round(allRecords.reduce((sum, r) => sum + r.progress, 0) / allRecords.length)
        : 0;

    return { totalEmployees: employees.length, totalEnrollments: allRecords.length, completed, inProgress, notStarted, overdue, avgCompletion };
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
          title: t.trainingTitle, enrolled: 0, completed: 0, avgProgress: 0, totalProgress: 0,
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
      result = result.filter((e) => e.trainings.some((t) => t.status === statusFilter));
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
              { icon: Users, value: stats.totalEmployees, label: "Employees", accent: "bg-[hsl(var(--ey-black))]/6", iconColor: "text-[hsl(var(--ey-grey-500))]" },
              { icon: BookOpen, value: stats.totalEnrollments, label: "Enrollments", accent: "bg-[hsl(var(--ey-blue-400))]/8", iconColor: "text-[hsl(var(--ey-blue-400))]" },
              { icon: CheckCircle2, value: stats.completed, label: "Completed", accent: "bg-[hsl(var(--ey-green-500))]/8", iconColor: "text-[hsl(var(--ey-green-500))]" },
              { icon: TrendingUp, value: `${stats.avgCompletion}%`, label: "Avg. Progress", accent: "bg-[hsl(var(--ey-yellow))]/10", iconColor: "ey-text-accent" },
              { icon: AlertTriangle, value: stats.overdue, label: "Overdue", accent: stats.overdue > 0 ? "bg-[hsl(var(--ey-red-500))]/8" : "bg-[hsl(var(--ey-grey-100))]", iconColor: stats.overdue > 0 ? "text-[hsl(var(--ey-red-500))]" : "text-[hsl(var(--ey-grey-400))]" },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="ey-animate-fade-up group flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  style={{ animationDelay: `${240 + i * 50}ms` }}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.accent} transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className={`h-4.5 w-4.5 ${kpi.iconColor}`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none tabular-nums">{kpi.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
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

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TrainingStatus | "all")}
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
                    onToggle={() => setExpandedId(expandedId === employee.id ? null : employee.id)}
                    statusFilter={statusFilter}
                  />
                ))
              ) : (
                <div className="ey-animate-scale-in flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-white py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-100))] mb-3">
                    <Users className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No employees match your filters</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filter criteria.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT (1/3): Insights ── */}
          <div className="space-y-6">
            <div className="ey-animate-fade-up" style={{ animationDelay: "100ms" }}>
              <CompletionFunnel
                completed={stats.completed}
                inProgress={stats.inProgress}
                notStarted={stats.notStarted}
                total={stats.totalEnrollments}
              />
            </div>

            <div className="ey-animate-fade-up" style={{ animationDelay: "200ms" }}>
              <CategoryPerformance items={categoryStats} />
            </div>

            <div className="ey-animate-fade-up" style={{ animationDelay: "300ms" }}>
              <TopTrainings items={trainingPerformance.slice(0, 5)} />
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
