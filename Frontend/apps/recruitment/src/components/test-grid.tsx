"use client";

import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import type { Test } from "@/types";
import { TestCard } from "./test-card";

interface TestGridProps {
  tests: Test[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (p: number) => void;
}

export function TestGrid({ tests, currentPage, totalPages, totalCount, onPageChange }: TestGridProps) {
  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
          <ClipboardList className="w-7 h-7 text-zinc-400" />
        </div>
        <h3 className="text-base font-semibold text-zinc-900 mb-1">No tests found</h3>
        <p className="text-sm text-zinc-500 max-w-xs">
          Try adjusting your filters or create a new test to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tests.map((test) => (
          <TestCard key={test.id} test={test} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <p className="text-sm text-zinc-500">
            Showing <span className="font-medium text-zinc-900">{tests.length}</span> of{" "}
            <span className="font-medium text-zinc-900">{totalCount}</span> tests
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-200
                hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  p === currentPage
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-200
                hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}