"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Skeleton, TooltipProvider } from "@repo/ui";
import { ArrowLeft, Users } from "lucide-react";
import { getCellEmployees, getIdentityUsers } from "@/services/admin-service";
import type { CellEmployee, IdentityUser } from "@/types/admin";
import { EmployeeCard, type EnrichedEmployee } from "./cell-employee-card";
import { CellKpiRow } from "./cell-kpi-row";

interface CellEmployeesPageProps {
  gradeId: string;
  serviceLineId: string;
  gradeName: string;
  serviceLineName: string;
}

type SortKey = "pct-desc" | "pct-asc" | "name" | "activity";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "pct-desc", label: "Completion ↓" },
  { id: "pct-asc", label: "Completion ↑" },
  { id: "name", label: "Name A–Z" },
  { id: "activity", label: "Last Active" },
];

export function CellEmployeesPage({ gradeId, serviceLineId, gradeName, serviceLineName }: CellEmployeesPageProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<CellEmployee[]>([]);
  const [identityUsers, setIdentityUsers] = useState<IdentityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("pct-desc");

  useEffect(() => {
    if (!gradeId || !serviceLineId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getCellEmployees(gradeId, serviceLineId), getIdentityUsers()])
      .then(([emps, users]) => { if (!cancelled) { setEmployees(emps); setIdentityUsers(users); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gradeId, serviceLineId]);

  const enriched: EnrichedEmployee[] = useMemo(() => {
    const userMap = new Map(identityUsers.map((u) => [u.id, u]));
    return employees.map((emp) => {
      const user = userMap.get(emp.employeeId);
      return { ...emp, trainingBreakdown: emp.trainingBreakdown ?? [], fullName: user?.fullName ?? `Employee ${emp.employeeId.slice(0, 8)}`, email: user?.email ?? "—", jobTitle: user?.jobTitle };
    });
  }, [employees, identityUsers]);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      if (sort === "pct-desc") return b.completionPercentage - a.completionPercentage;
      if (sort === "pct-asc") return a.completionPercentage - b.completionPercentage;
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime();
    });
  }, [enriched, sort]);

  const kpis = useMemo(() => {
    if (enriched.length === 0) return null;
    const fully = enriched.filter((e) => e.completionPercentage === 100).length;
    const inProg = enriched.filter((e) => e.completionPercentage > 0 && e.completionPercentage < 100).length;
    const avg = Math.round(enriched.reduce((s, e) => s + e.completionPercentage, 0) / enriched.length);
    return { fully, inProg, avg };
  }, [enriched]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4 px-8 py-4">
            <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="h-4 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Admin · Programme Matrix</p>
              <h1 className="text-sm font-semibold leading-tight">{gradeName || "Grade"} <span className="text-muted-foreground">×</span> {serviceLineName || "Service Line"}</h1>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-8 py-8 space-y-8">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
            </div>
          ) : (
            <CellKpiRow enrichedCount={enriched.length} kpis={kpis} />
          )}

          {!loading && sorted.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Sort by:</span>
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => setSort(opt.id)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${sort === opt.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}>
                  {opt.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">{sorted.length} employee{sorted.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[200px] rounded-xl" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No employees in this cell</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Assign employees to {gradeName} × {serviceLineName} from Employee Profiles.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((emp) => <EmployeeCard key={emp.employeeId} emp={emp} />)}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
