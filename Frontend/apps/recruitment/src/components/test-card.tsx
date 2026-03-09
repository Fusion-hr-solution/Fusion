"use client";

import { useState } from "react";
import { MoreHorizontal, Edit2, Copy, Archive, Trash2, Users, Hash, Calendar } from "lucide-react";
import type { Test } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<Test["status"], string> = {
  Active: "bg-zinc-900 text-white",
  Draft: "bg-zinc-100 text-zinc-600",
  Archived: "bg-zinc-100 text-zinc-400",
};

interface TestCardProps {
  test: Test;
}

export function TestCard({ test }: TestCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative group bg-white border border-zinc-200 rounded-xl p-5 flex flex-col gap-4
      hover:shadow-lg hover:border-zinc-300 transition-all duration-200">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-md">
              {test.discipline}
            </span>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md", STATUS_STYLES[test.status])}>
              {test.status}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 mt-2">
            {test.title}
          </h3>
        </div>

        {/* Action menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 rounded-lg flex items-center justify-center
              opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all duration-200"
          >
            <MoreHorizontal className="w-4 h-4 text-zinc-500" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl z-20 overflow-hidden">
                {[
                  { icon: Edit2, label: "Edit test" },
                  { icon: Copy, label: "Duplicate" },
                  { icon: Archive, label: "Archive" },
                  { icon: Trash2, label: "Delete", destructive: true },
                ].map(({ icon: Icon, label, destructive }) => (
                  <button
                    key={label}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 text-left",
                      destructive
                        ? "text-red-600 hover:bg-red-50"
                        : "text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed flex-1">
        {test.description}
      </p>

      {/* Question type badges */}
      <div className="flex flex-wrap gap-1.5">
        {test.questionTypes.map((qt) => (
          <span key={qt} className="text-xs px-2 py-0.5 border border-zinc-200 rounded-md text-zinc-600">
            {qt}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 pt-3 border-t border-zinc-100">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Hash className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700">{test.questionCount}</span> questions
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Users className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700">{test.candidateCount}</span> candidates
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 ml-auto">
          <Calendar className="w-3 h-3" />
          {new Date(test.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}