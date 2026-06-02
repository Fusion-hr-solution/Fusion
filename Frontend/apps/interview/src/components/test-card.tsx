"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Clock,
  Copy,
  Eye,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Test, TestStatus } from "@/types";

interface TestCardProps {
  test: Test;
  onOpen: (test: Test) => void;
  onEdit: (test: Test) => void;
  onPreview: (test: Test) => void;
  onDuplicate: (test: Test) => void;
  onSetStatus: (test: Test, status: TestStatus) => void;
  onDelete: (test: Test) => void;
  isBusy?: boolean;
}

const STATUS_CONFIG: Record<
  Test["status"],
  { badge: string; accent: string; dot: string }
> = {
  Active: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    accent: "border-emerald-400",
    dot: "bg-emerald-400",
  },
  Draft: {
    badge: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
    accent: "border-zinc-300",
    dot: "bg-zinc-300",
  },
  Archived: {
    badge: "bg-zinc-50 text-zinc-400 ring-1 ring-zinc-200",
    accent: "border-zinc-200",
    dot: "bg-zinc-200",
  },
};

export function TestCard({
  test,
  onOpen,
  onEdit,
  onPreview,
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

  function handleOpen(): void {
    if (isBusy) return;
    onOpen(test);
  }

  const statusCfg = STATUS_CONFIG[test.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.currentTarget !== e.target) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-3 rounded-xl border-l-[3px] border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-150 hover:shadow-md hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
        statusCfg.accent
      )}
    >
      {/* Top row: discipline + status + menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
            {test.discipline}
          </span>
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            statusCfg.badge
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
            {test.status}
          </span>
        </div>

        {/* Actions menu */}
        <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
              {[
                { icon: Eye, label: "Preview", action: onPreview },
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
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <item.icon className="h-3.5 w-3.5 text-zinc-500" />
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
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 transition-colors duration-150 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold leading-snug text-zinc-900 line-clamp-2">
        {test.title}
      </h3>

      {/* Description */}
      <p className="flex-1 text-[13px] leading-relaxed text-zinc-500 line-clamp-2">
        {test.description || <span className="italic text-zinc-300">No description</span>}
      </p>

      {/* Question type badges */}
      {test.questionTypes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {test.questionTypes.slice(0, 4).map((type) => (
            <span
              key={type}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
            >
              {type}
            </span>
          ))}
          {test.questionTypes.length > 4 ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              +{test.questionTypes.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Metadata footer */}
      <div className="flex items-center gap-3 border-t border-zinc-100 pt-2.5 text-[12px] text-zinc-400">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {test.candidateCount}
        </span>
        <span className="h-3 w-px bg-zinc-200" />
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3.5 w-3.5" />
          {test.questionCount}
        </span>
        <span className="h-3 w-px bg-zinc-200" />
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {new Date(test.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {isBusy ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700" />
        </div>
      ) : null}
    </div>
  );
}
