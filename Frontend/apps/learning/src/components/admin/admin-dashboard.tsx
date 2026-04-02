"use client";

import { useState } from "react";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { TooltipProvider, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@repo/ui";
import type { TrainingStatus } from "@/types";
import type { AdminDashboardProps } from "@/types/admin-props";
import { useAdminDashboardData } from "@/hooks/use-admin-dashboard-data";
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

  const { stats, departments, categoryStats, trainingPerformance, filteredEmployees } =
    useAdminDashboardData(employees, search, deptFilter, statusFilter);

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
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9 w-[160px] text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d === "all" ? "All Departments" : d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TrainingStatus | "all")}>
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="not-started">Not Started</SelectItem>
                  </SelectContent>
                </Select>
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
