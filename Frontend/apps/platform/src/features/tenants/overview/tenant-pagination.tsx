"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";

/**
 * Where the operator is in the whole result, and how to move.
 *
 * The range and total come from the service's count of everything the query
 * matches, so the footer never describes only the rows it can see.
 */
export function TenantPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      aria-label="Tenant directory pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"
    >
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Showing <span className="tabular-nums text-foreground">{from}</span>–
        <span className="tabular-nums text-foreground">{to}</span> of{" "}
        <span className="tabular-nums text-foreground">{totalCount}</span>{" "}
        {totalCount === 1 ? "tenant" : "tenants"}
      </p>

      {/* A single page needs no controls, but the range above still does: it is
          the answer to "how many are there?", not just a navigation aid. */}
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>

          <ol className="flex items-center gap-1">
            {pageNumbers(page, pageCount).map((entry, index) =>
              entry === "gap" ? (
                <li
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="px-1 text-sm text-muted-foreground"
                >
                  …
                </li>
              ) : (
                <li key={entry}>
                  <Button
                    variant={entry === page ? "default" : "ghost"}
                    size="sm"
                    aria-label={`Page ${entry}`}
                    aria-current={entry === page ? "page" : undefined}
                    onClick={() => onPageChange(entry)}
                    className={cn("min-w-9 tabular-nums")}
                  >
                    {entry}
                  </Button>
                </li>
              )
            )}
          </ol>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}

/**
 * First page, last page, and a window around the current one. The control keeps
 * a stable width as the operator moves rather than growing with the result set.
 */
export function pageNumbers(
  page: number,
  pageCount: number
): Array<number | "gap"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const window = new Set([1, pageCount, page, page - 1, page + 1]);

  // Keep the run near the ends the same length as the run in the middle, so the
  // control does not visibly shrink on the first and last pages.
  if (page <= 3) [2, 3, 4].forEach((entry) => window.add(entry));
  if (page >= pageCount - 2) {
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((entry) => window.add(entry));
  }

  const pages = [...window]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);

  const result: Array<number | "gap"> = [];
  let previous = 0;

  for (const entry of pages) {
    if (previous && entry - previous > 1) result.push("gap");
    result.push(entry);
    previous = entry;
  }

  return result;
}
