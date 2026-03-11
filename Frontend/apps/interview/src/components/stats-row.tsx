"use client";

import { ClipboardList, Zap, HelpCircle, Users } from "lucide-react";
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
    },
    {
      label: "Active Tests",
      value: activeTests,
      description: `${totalTests - activeTests} inactive`,
      icon: Zap,
    },
    {
      label: "Avg Questions",
      value: avgQuestions,
      description: "Per test",
      icon: HelpCircle,
    },
    {
      label: "Candidates Tested",
      value: totalCandidates,
      description: "All time",
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 px-8 pt-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="relative rounded-lg border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-150"
          >
            <Icon className="absolute right-4 top-4 h-5 w-5 text-zinc-300" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {stat.label}
            </p>
            <p className="mt-1.5 text-[28px] font-bold text-zinc-900 leading-none">
              {stat.value.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[12px] text-zinc-400">{stat.description}</p>
          </div>
        );
      })}
    </div>
  );
}