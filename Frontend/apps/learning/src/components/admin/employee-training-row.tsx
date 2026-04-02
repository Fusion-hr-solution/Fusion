import { AlertTriangle } from "lucide-react";
import { CATEGORY_CONFIG } from "@/data/categories";
import { STATUS_COLORS, STATUS_ICONS, statusLabel } from "./admin-constants";

interface EmployeeTraining {
  trainingId: string;
  trainingTitle: string;
  category: string;
  status: "completed" | "in-progress" | "not-started";
  progress: number;
  deadline?: string;
}

interface EmployeeTrainingRowProps {
  training: EmployeeTraining;
}

export function EmployeeTrainingRow({ training }: EmployeeTrainingRowProps) {
  const catConfig = CATEGORY_CONFIG[training.category as keyof typeof CATEGORY_CONFIG];
  const Icon = STATUS_ICONS[training.status];
  const isOverdue =
    training.deadline &&
    training.status !== "completed" &&
    new Date(training.deadline) < new Date();

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3.5 py-2.5 transition-colors hover:bg-muted">
      <div className={`h-8 w-1 rounded-full ${catConfig?.stripClass ?? "bg-muted-foreground/30"}`} />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {training.trainingTitle}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[training.status]}`}>
            <Icon className="h-2.5 w-2.5" aria-hidden="true" />
            {statusLabel(training.status)}
          </span>
          {catConfig && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${catConfig.badgeClass}`}>
              {catConfig.label}
            </span>
          )}
          {isOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
              Overdue
            </span>
          )}
        </div>
      </div>

      <div className="relative flex h-9 w-9 items-center justify-center">
        <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--ey-grey-200))" strokeWidth="2.5" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke={training.status === "completed" ? "hsl(var(--ey-green-500))" : "hsl(var(--ey-blue-400))"}
            strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${(training.progress / 100) * 94.2} 94.2`}
          />
        </svg>
        <span className="absolute text-[9px] font-bold text-foreground tabular-nums">
          {training.progress}%
        </span>
      </div>
    </div>
  );
}
