"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  skip: number;
  take: number;
  totalCount: number;
  onPageChange: (skip: number) => void;
}

export function PaginationBar({
  skip,
  take,
  totalCount,
  onPageChange,
}: PaginationBarProps) {
  const currentPage = Math.floor(skip / take) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / take));
  const start = totalCount === 0 ? 0 : skip + 1;
  const end = Math.min(skip + take, totalCount);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {totalCount === 0
          ? "No results"
          : `${start}–${end} of ${totalCount}`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(0, skip - take))}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-2 tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(skip + take)}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
