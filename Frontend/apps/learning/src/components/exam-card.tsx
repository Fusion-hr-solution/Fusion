import {
  GraduationCap,
  HelpCircle,
  Target,
  Clock,
  RotateCcw,
  Lock,
} from "lucide-react";
import type { ExamCardProps } from "@/types/component-props";

export function ExamCard({ exam, chaptersCount, isEnrolled }: ExamCardProps) {
  const stats = [
    {
      icon: HelpCircle,
      value: `${exam.questionsCount} questions`,
      label: "Total Questions",
    },
    {
      icon: Target,
      value: `${exam.passingScore}%`,
      label: "Passing Score",
    },
    ...(exam.timeLimit
      ? [{ icon: Clock, value: exam.timeLimit, label: "Time Limit" }]
      : []),
    ...(exam.maxAttempts
      ? [{ icon: RotateCcw, value: `${exam.maxAttempts} attempts`, label: "Max Attempts" }]
      : []),
  ];

  return (
    <div className="ey-animate-fade-up rounded-2xl border border-border/60 bg-white overflow-hidden">
      {/* Exam header with accent */}
      <div className="relative flex items-center gap-3 border-b border-border/40 bg-gradient-to-r from-[hsl(var(--ey-yellow))]/8 to-transparent px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--ey-yellow))]/15 ring-1 ring-[hsl(var(--ey-yellow))]/20">
          <GraduationCap
            className="h-5 w-5 text-[hsl(var(--ey-grey-500))]"
            aria-hidden="true"
          />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Certification Exam
          </h3>
          <p className="text-xs text-muted-foreground">
            Validate your knowledge to earn your certificate
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-border/30 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-2 bg-white px-4 py-5 text-center"
            >
              <Icon
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-sm font-bold text-foreground">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unlock callout — shown only for enrolled users */}
      {isEnrolled && (
        <div className="flex items-center gap-2.5 border-t border-border/40 bg-[hsl(var(--ey-grey-50))] px-6 py-3">
          <Lock
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-xs text-muted-foreground">
            Complete all{" "}
            <span className="font-semibold text-foreground">
              {chaptersCount} chapters
            </span>{" "}
            to unlock the exam
          </p>
        </div>
      )}
    </div>
  );
}
