"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@repo/ui";

interface PaginationBarProps {
  skip: number;
  take: number;
  totalCount: number;
  onPageChange: (skip: number) => void;
  onPageSizeChange?: (size: PageSize) => void;
}

export function PaginationBar({
  skip,
  take,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const currentPage = Math.floor(skip / take) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / take));
  const start = totalCount === 0 ? 0 : skip + 1;
  const end = Math.min(skip + take, totalCount);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          {totalCount === 0 ? "No results" : `${start}–${end} of ${totalCount}`}
        </span>
        {onPageSizeChange && (
          <Select
            value={String(take)}
            onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
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
