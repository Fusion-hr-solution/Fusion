"use client";

import type { LucideIcon } from "lucide-react";
import { ClipboardList, HelpCircle, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";
import type { Test } from "@/types";

interface StatsRowProps {
  tests: Test[];
}

interface StatDef {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  accentBar: string;
}

function StatCard({ stat, index }: { stat: StatDef; index: number }) {
  const Icon = stat.icon;
  const displayValue = useCountUp(stat.value);

  return (
    // Wrapper owns the staggered entrance so the inner card's hover transform stays free.
    <div className="dash-rise" style={{ animationDelay: `${index * 70}ms` }}>
      <div
        className={cn(
          "group relative h-full overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-sm",
          "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
        )}
      >
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-1 transition-all duration-200 group-hover:w-1.5",
            stat.accentBar
          )}
        />
        <div className="flex items-start justify-between gap-3 pl-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {stat.label}
            </p>
            <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-zinc-900 tabular-nums">
              {displayValue.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[12px] text-zinc-400">{stat.description}</p>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
              stat.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", stat.iconColor)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsRow({ tests }: StatsRowProps) {
  const totalTests = tests.length;
  const activeTests = tests.filter((t) => t.status === "Active").length;
  const avgQuestions =
    tests.length > 0
      ? Math.round(tests.reduce((sum, t) => sum + t.questionCount, 0) / tests.length)
      : 0;
  const totalCandidates = tests.reduce((sum, t) => sum + t.candidateCount, 0);

  const stats: StatDef[] = [
    {
      label: "Total Tests",
      value: totalTests,
      description: "Across all disciplines",
      icon: ClipboardList,
      iconBg: "bg-zinc-100",
      iconColor: "text-zinc-600",
      accentBar: "bg-gradient-to-b from-zinc-300 to-zinc-200",
    },
    {
      label: "Active Tests",
      value: activeTests,
      description: `${totalTests - activeTests} inactive`,
      icon: Zap,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      accentBar: "bg-gradient-to-b from-emerald-400 to-emerald-300",
    },
    {
      label: "Avg Questions",
      value: avgQuestions,
      description: "Per test",
      icon: HelpCircle,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      accentBar: "bg-gradient-to-b from-blue-400 to-blue-300",
    },
    {
      label: "Candidates Tested",
      value: totalCandidates,
      description: "All time",
      icon: Users,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      accentBar: "bg-gradient-to-b from-indigo-400 to-indigo-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 px-8 pt-6 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={stat.label} stat={stat} index={index} />
      ))}
    </div>
  );
}
