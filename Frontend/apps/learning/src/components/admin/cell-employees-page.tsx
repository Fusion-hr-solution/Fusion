"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Skeleton, TooltipProvider } from "@repo/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  Users,
  TrendingUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getCellEmployees, getIdentityUsers } from "@/services/admin-service";
import type { CellEmployee, CellEmployeeTrainingProgress, IdentityUser } from "@/types/admin";

interface CellEmployeesPageProps {
  gradeId: string;
  serviceLineId: string;
  gradeName: string;
  serviceLineName: string;
}

interface EnrichedEmployee extends CellEmployee {
  fullName: string;
  email: string;
  jobTitle?: string | null;
}

// ── helpers ────────────────────────────────────────────────────────────────

function progressBarColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function avatarColor(name: string): string {
  const colors: string[] = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-cyan-500",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx] ?? "bg-blue-500";
}

function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── sub-components ─────────────────────────────────────────────────────────

function TrainingRow({ t }: { t: CellEmployeeTrainingProgress }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="w-4 shrink-0">
        {t.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : t.status === "in-progress" ? (
          <Clock className="h-4 w-4 text-amber-500" />
        ) : t.status === "failed" ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium truncate">{t.trainingTitle}</span>
          {t.isRequired && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              Required
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{t.credits} cr</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressBarColor(t.progressPercentage)}`}
              style={{ width: `${t.progressPercentage}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
            {t.progressPercentage}%
          </span>
        </div>
      </div>
    </div>
  );
}

function EmployeeCard({ emp }: { emp: EnrichedEmployee }) {
  const [expanded, setExpanded] = useState(false);
  const pct = emp.completionPercentage;
  const breakdown = emp.trainingBreakdown ?? [];
  const hasPartialProgress = breakdown.some(
    (t) => t.progressPercentage > 0 && t.status !== "completed",
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* top bar */}
      <div
        className="h-1 rounded-t-xl"
        style={{
          background:
            pct >= 80
              ? "var(--ey-green-500, #22c55e)"
              : pct >= 40
                ? "var(--ey-amber-500, #f59e0b)"
                : "hsl(var(--muted))",
        }}
      />

      <div className="p-5">
        {/* header row */}
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 shrink-0 rounded-full text-white text-sm font-bold flex items-center justify-center ${avatarColor(emp.fullName)}`}
          >
            {initials(emp.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{emp.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
            {emp.gradeName && (
              <p className="text-xs text-muted-foreground/70 truncate">{emp.gradeName}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold tabular-nums text-foreground">{pct}%</p>
            <p className="text-[10px] text-muted-foreground">completion</p>
          </div>
        </div>

        {/* overall progress bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-muted-foreground">
              {emp.completedFormations} / {emp.totalFormations} formations completed
            </span>
            {hasPartialProgress && (
              <span className="text-[10px] text-amber-600 font-medium">• In progress</span>
            )}
          </div>
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressBarColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* last activity */}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last activity:{" "}
          <span className="font-medium text-foreground/70">
            {formatDate(emp.lastActivityAt)}
          </span>
        </p>

        {/* expand / collapse per-training breakdown */}
        {breakdown.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/50 pt-3"
          >
            <span>
              {expanded ? "Hide" : "Show"} training breakdown ({breakdown.length})
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {expanded && (
          <div className="mt-2">
            {breakdown.map((t) => (
              <TrainingRow key={t.trainingId} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className={`rounded-lg p-2 ${accent ?? "bg-muted"}`}>
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── main page ───────────────────────────────────────────────────────────────

export function CellEmployeesPage({
  gradeId,
  serviceLineId,
  gradeName,
  serviceLineName,
}: CellEmployeesPageProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<CellEmployee[]>([]);
  const [identityUsers, setIdentityUsers] = useState<IdentityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"pct-desc" | "pct-asc" | "name" | "activity">("pct-desc");

  useEffect(() => {
    if (!gradeId || !serviceLineId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getCellEmployees(gradeId, serviceLineId),
      getIdentityUsers(),
    ]).then(([emps, users]) => {
      if (cancelled) return;
      setEmployees(emps);
      setIdentityUsers(users);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [gradeId, serviceLineId]);

  // merge identity names into cell employees
  const enriched: EnrichedEmployee[] = useMemo(() => {
    const userMap = new Map(identityUsers.map((u) => [u.id, u]));
    return employees.map((emp) => {
      const user = userMap.get(emp.employeeId);
      return {
        ...emp,
        trainingBreakdown: emp.trainingBreakdown ?? [],
        fullName: user?.fullName ?? `Employee ${emp.employeeId.slice(0, 8)}`,
        email: user?.email ?? "—",
        jobTitle: user?.jobTitle,
      };
    });
  }, [employees, identityUsers]);

  // sort
  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      if (sort === "pct-desc") return b.completionPercentage - a.completionPercentage;
      if (sort === "pct-asc") return a.completionPercentage - b.completionPercentage;
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime();
    });
  }, [enriched, sort]);

  // kpis
  const kpis = useMemo(() => {
    if (enriched.length === 0) return null;
    const fully = enriched.filter((e) => e.completionPercentage === 100).length;
    const inProg = enriched.filter(
      (e) => e.completionPercentage > 0 && e.completionPercentage < 100,
    ).length;
    const notStarted = enriched.filter((e) => e.completionPercentage === 0).length;
    const avg = Math.round(
      enriched.reduce((s, e) => s + e.completionPercentage, 0) / enriched.length,
    );
    return { fully, inProg, notStarted, avg };
  }, [enriched]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        {/* ── sticky header ── */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4 px-8 py-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="h-4 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Admin · Programme Matrix</p>
              <h1 className="text-sm font-semibold leading-tight">
                {gradeName || "Grade"}{" "}
                <span className="text-muted-foreground">×</span>{" "}
                {serviceLineName || "Service Line"}
              </h1>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-8 py-8 space-y-8">
          {/* ── KPI row ── */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-xl" />
              ))}
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile icon={Users} label="Total Employees" value={enriched.length} accent="bg-blue-50" />
              <KpiTile icon={TrendingUp} label="Avg. Completion" value={`${kpis.avg}%`} accent="bg-primary/10" />
              <KpiTile icon={CheckCircle2} label="Fully Completed" value={kpis.fully} accent="bg-emerald-50" />
              <KpiTile icon={BookOpen} label="In Progress" value={kpis.inProg} accent="bg-amber-50" />
            </div>
          ) : null}

          {/* ── sort controls ── */}
          {!loading && sorted.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Sort by:</span>
              {(
                [
                  { id: "pct-desc", label: "Completion ↓" },
                  { id: "pct-asc", label: "Completion ↑" },
                  { id: "name", label: "Name A–Z" },
                  { id: "activity", label: "Last Active" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    sort === opt.id
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                {sorted.length} employee{sorted.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* ── employee cards ── */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[200px] rounded-xl" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No employees in this cell
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Assign employees to {gradeName} × {serviceLineName} from Employee Profiles.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((emp) => (
                <EmployeeCard key={emp.employeeId} emp={emp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
