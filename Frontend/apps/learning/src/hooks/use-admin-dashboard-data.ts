import { useMemo } from "react";
import type { TrainingCategory, TrainingStatus, Employee } from "@/types";

export function useAdminDashboardData(
  employees: Employee[],
  search: string,
  deptFilter: string,
  statusFilter: TrainingStatus | "all",
) {
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

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department));
    return ["all", ...Array.from(depts).sort()];
  }, [employees]);

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

  return { stats, departments, categoryStats, trainingPerformance, filteredEmployees };
}
