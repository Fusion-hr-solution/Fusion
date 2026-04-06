"use client";

import { useState, useRef, useEffect } from "react";
import {
  Users, HelpCircle, Clock, MoreHorizontal,
  Pencil, Copy, Archive, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Test, TestStatus } from "@/types";

interface TestCardProps {
  test: Test;
  onEdit: (test: Test) => void;
  onDuplicate: (test: Test) => void;
  onSetStatus: (test: Test, status: TestStatus) => void;
  onDelete: (test: Test) => void;
  isBusy?: boolean;
}

const STATUS_STYLES: Record<Test["status"], string> = {
  Active: "bg-zinc-900 text-white",
  Draft: "border border-zinc-300 text-zinc-600 bg-white",
  Archived: "bg-zinc-100 text-zinc-400",
};

export function TestCard({
  test,
  onEdit,
  onDuplicate,
  onSetStatus,
  onDelete,
  isBusy = false,
}: TestCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="group relative flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-150">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
          {test.discipline}
        </span>

        {/* Actions menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors duration-150"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg z-20 overflow-hidden">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Set Status
              </div>
              {(["Active", "Draft", "Archived"] as TestStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setMenuOpen(false);
                    onSetStatus(test, status);
                  }}
                  disabled={isBusy || test.status === status}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors duration-150",
                    test.status === status
                      ? "bg-zinc-100 font-semibold text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  {status}
                </button>
              ))}
              <div className="border-t border-zinc-100" />
              {[
                { icon: Pencil, label: "Edit", action: onEdit },
                { icon: Copy, label: "Duplicate", action: onDuplicate },
                { icon: Archive, label: "Archive", action: (item: Test) => onSetStatus(item, "Archived") },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setMenuOpen(false);
                    item.action(test);
                  }}
                  disabled={isBusy}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50 transition-colors duration-150"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
              <div className="border-t border-zinc-100" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(test);
                }}
                disabled={isBusy}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-zinc-50 transition-colors duration-150"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-zinc-900 line-clamp-2 leading-snug">
        {test.title}
      </h3>

      {/* Description */}
      <p className="text-[13px] text-zinc-500 line-clamp-2 leading-relaxed">
        {test.description}
      </p>

      {/* Question type badges */}
      <div className="flex flex-wrap gap-1.5">
        {test.questionTypes.map((type) => (
          <span
            key={type}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
          >
            {type}
          </span>
        ))}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-[12px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {test.candidateCount}
        </span>
        <span className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          {test.questionCount} questions
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {new Date(test.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* Status */}
      <div className="pt-1 border-t border-zinc-100">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            STATUS_STYLES[test.status]
          )}
        >
          {test.status}
        </span>
      </div>
    </div>
  );
}