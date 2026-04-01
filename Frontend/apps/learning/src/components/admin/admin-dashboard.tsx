"use client";

import { useMemo, useState } from "react";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { TooltipProvider } from "@repo/ui";
import type { TrainingCategory, TrainingStatus } from "@/types";
import type { AdminDashboardProps } from "@/types/admin-props";
import { PageHeader } from "../page-header";
import { KpiCard } from "../kpi-card";
import { SearchInput } from "../search-input";
import { EmptyState } from "../empty-state";
import { EmployeeRow } from "./employee-row";
import { CompletionFunnel } from "./completion-funnel";
import { CategoryPerformance } from "./category-performance";
import { TopTrainings } from "./top-trainings";

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
      <PageHeader
        moduleTitle="Administration"
        title="Employee Training Overview"
        description="Monitor team progress, identify gaps, and ensure compliance across all training programs."
      >
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            {[
              { icon: Users, value: stats.totalEmployees, label: "Employees" },
              { icon: BookOpen, value: stats.totalEnrollments, label: "Enrollments" },
              { icon: CheckCircle2, value: stats.completed, label: "Completed" },
              { icon: TrendingUp, value: `${stats.avgCompletion}%`, label: "Avg. Progress" },
              { icon: AlertTriangle, value: stats.overdue, label: "Overdue" },
            ].map((kpi, i) => (
              <KpiCard key={kpi.label} icon={kpi.icon} value={kpi.value} label={kpi.label} index={i} />
            ))}
          </div>
      </PageHeader>

      {/* ── Main content ── */}
      <section className="px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT (2/3): Employee table ── */}
          <div className="space-y-5 lg:col-span-2">
            {/* Filters */}
            <div
              className="ey-animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ animationDelay: "60ms" }}
            >
              <div className="relative flex-1 max-w-sm">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search employees..."
                  ariaLabel="Search employees"
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
                filteredEmployees.map((employee, _idx) => (
                  <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    expanded={expandedId === employee.id}
                    onToggle={() => setExpandedId(expandedId === employee.id ? null : employee.id)}
                    statusFilter={statusFilter}
                  />
                ))
              ) : (
                <EmptyState
                  icon={Users}
                  title="No employees match your filters"
                  subtitle="Try adjusting your search or filter criteria."
                />
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
