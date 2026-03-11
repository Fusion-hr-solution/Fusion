"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-8 py-6">
      <span className="text-[13px] text-zinc-500">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
            currentPage <= 1
              ? "cursor-not-allowed opacity-40 text-zinc-400"
              : "text-zinc-700 hover:bg-zinc-50"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
            currentPage >= totalPages
              ? "cursor-not-allowed opacity-40 text-zinc-400"
              : "text-zinc-700 hover:bg-zinc-50"
          )}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}