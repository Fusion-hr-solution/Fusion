import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  Avatar,
  AvatarFallback,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@repo/ui";
import type { Employee, TrainingStatus } from "@/types";
import { CATEGORY_CONFIG } from "@/data/categories";
import {
  initials,
  statusLabel,
  STATUS_COLORS,
  STATUS_ICONS,
  AVATAR_COLOR,
} from "./admin-constants";

interface EmployeeRowProps {
  employee: Employee;
  expanded: boolean;
  onToggle: () => void;
  statusFilter: TrainingStatus | "all";
}

export function EmployeeRow({
  employee,
  expanded,
  onToggle,
  statusFilter,
}: EmployeeRowProps) {
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
