"use client";

import { ClipboardList, HelpCircle, Users, Zap } from "lucide-react";
import type { Test } from "@/types";

interface StatsRowProps {
  tests: Test[];
}

export function StatsRow({ tests }: StatsRowProps) {
  const totalTests = tests.length;
  const activeTests = tests.filter((t) => t.status === "Active").length;
  const avgQuestions =
    tests.length > 0
      ? Math.round(tests.reduce((sum, t) => sum + t.questionCount, 0) / tests.length)
      : 0;
  const totalCandidates = tests.reduce((sum, t) => sum + t.candidateCount, 0);

  const stats = [
    {
      label: "Total Tests",
      value: totalTests,
      description: "Across all disciplines",
      icon: ClipboardList,
      iconBg: "bg-zinc-100",
      iconColor: "text-zinc-600",
      accentBar: "bg-zinc-300",
    },
    {
      label: "Active Tests",
      value: activeTests,
      description: `${totalTests - activeTests} inactive`,
      icon: Zap,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      accentBar: "bg-emerald-400",
    },
    {
      label: "Avg Questions",
      value: avgQuestions,
      description: "Per test",
      icon: HelpCircle,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      accentBar: "bg-blue-400",
    },
    {
      label: "Candidates Tested",
      value: totalCandidates,
      description: "All time",
      icon: Users,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      accentBar: "bg-indigo-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 px-8 pt-6 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md"
          >
            <div className={`absolute left-0 top-0 h-full w-1 ${stat.accentBar}`} />
            <div className="flex items-start justify-between gap-3 pl-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-zinc-900">
                  {stat.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-[12px] text-zinc-400">{stat.description}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stat.iconBg}`}>
                <Icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
