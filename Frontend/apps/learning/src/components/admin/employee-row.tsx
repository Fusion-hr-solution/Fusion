"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  Card,
  Avatar,
  AvatarFallback,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@repo/ui";
import type { EmployeeRowProps } from "@/types/admin-props";
import { initials, AVATAR_COLOR } from "./admin-constants";
import { EmployeeTrainingRow } from "./employee-training-row";

export function EmployeeRow({
  employee,
  expanded,
  onToggle,
  statusFilter,
}: EmployeeRowProps) {
  const t = useTranslations("adminEmployees");
  const completed = employee.trainings.filter(
    (t) => t.status === "completed"
  ).length;
  const total = employee.trainings.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

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
          ? "border-border shadow-lg shadow-black/5"
          : "border-border/60 hover:shadow-md hover:shadow-black/4 hover:border-border"
      } bg-white`}
    >
      <button
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? t("rowCollapseAria", { name: employee.name })
            : t("rowExpandAria", { name: employee.name })
        }
      >
        <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
          <AvatarFallback
            className={`${AVATAR_COLOR} text-white text-xs font-bold`}
          >
            {initials(employee.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {employee.name}
            </p>
            {overdue.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex h-5 items-center gap-1 rounded-full bg-destructive/10 px-2 text-[10px] font-bold text-destructive">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {overdue.length}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("overdueCount", { count: overdue.length })}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {employee.role} · {employee.department}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-bold text-foreground tabular-nums">
              {completed}/{total}
            </span>
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--ey-green-500))] transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-transform duration-200">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="ey-animate-fade-up border-t border-border/40">
          <div className="px-4 py-3 space-y-2">
            {filteredTrainings.map((training) => (
              <EmployeeTrainingRow
                key={training.trainingId}
                training={training}
              />
            ))}
            {filteredTrainings.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t("noTrainingsMatchFilter")}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
