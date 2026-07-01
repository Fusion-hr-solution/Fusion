"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CellEmployee, CellEmployeeTrainingProgress } from "@/types/admin";
import {
  progressBarColor,
  avatarColor,
  initials,
} from "./cell-employees-helpers";

export interface EnrichedEmployee extends CellEmployee {
  fullName: string;
  email: string;
  jobTitle?: string | null;
}

function TrainingRow({ t }: { t: CellEmployeeTrainingProgress }) {
  const tr = useTranslations("adminCells");
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="w-4 shrink-0">
        {t.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--ey-green-500))]" />
        ) : t.status === "in-progress" ? (
          <Clock className="h-4 w-4 text-[hsl(var(--ey-orange-500))]" />
        ) : t.status === "failed" ? (
          <XCircle className="h-4 w-4 text-[hsl(var(--ey-red-500))]" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium truncate">
            {t.trainingTitle}
          </span>
          {t.isRequired && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {tr("card.required")}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {tr("card.credits", { count: t.credits })}
          </span>
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

export function EmployeeCard({ emp }: { emp: EnrichedEmployee }) {
  const t = useTranslations("adminCells");
  const format = useFormatter();
  const [expanded, setExpanded] = useState(false);
  const pct = emp.completionPercentage;
  const breakdown = emp.trainingBreakdown ?? [];
  const hasPartialProgress = breakdown.some(
    (t) => t.progressPercentage > 0 && t.status !== "completed"
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div
        className="h-1 rounded-t-xl"
        style={{
          background:
            pct >= 80 ? "hsl(var(--ey-green-500))" : pct >= 40 ? "hsl(var(--ey-orange-500))" : "hsl(var(--muted))",
        }}
      />
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 shrink-0 rounded-full text-white text-sm font-bold flex items-center justify-center ${avatarColor(emp.fullName)}`}
          >
            {initials(emp.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {emp.fullName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {emp.email}
            </p>
            {emp.gradeName && (
              <p className="text-xs text-muted-foreground/70 truncate">
                {emp.gradeName}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold tabular-nums text-foreground">
              {pct}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("card.completion")}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-muted-foreground">
              {t("card.formationsCompleted", {
                completed: emp.completedFormations,
                total: emp.totalFormations,
              })}
            </span>
            {hasPartialProgress && (
              <span className="text-[10px] text-[hsl(var(--ey-orange-500))] font-medium">
                {t("card.inProgressDot")}
              </span>
            )}
          </div>
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressBarColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("card.lastActivity")}{" "}
          <span className="font-medium text-foreground/70">
            {emp.lastActivityAt
              ? format.dateTime(new Date(emp.lastActivityAt), {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : t("card.noActivity")}
          </span>
        </p>

        {breakdown.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/50 pt-3"
          >
            <span>
              {expanded
                ? t("card.hideBreakdown", { count: breakdown.length })
                : t("card.showBreakdown", { count: breakdown.length })}
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
