"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface CatalogPaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
}

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}

export function CatalogPagination({
  page,
  totalCount,
  pageSize,
}: CatalogPaginationProps) {
  const t = useTranslations("catalog.pagination");
  const searchParams = useSearchParams();

  function pageHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pageRange = buildPageRange(page, totalPages);

  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-xs text-muted-foreground">
        {t.rich("showing", {
          from,
          to,
          total: totalCount,
          b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </p>

      <nav className="flex items-center gap-1" aria-label={t("aria")}>
        {/* Previous */}
        <Link
          href={pageHref(page - 1)}
          aria-label={t("previousPage")}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-sm transition-colors",
            page <= 1
              ? "pointer-events-none text-muted-foreground/40 border-border/40"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        {/* Page numbers */}
        {pageRange.map((item, i) =>
          item === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={pageHref(item)}
              aria-label={t("pageAria", { page: item })}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                item === page
                  ? "ey-bg-dark border-transparent text-white"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item}
            </Link>
          )
        )}

        {/* Next */}
        <Link
          href={pageHref(page + 1)}
          aria-label={t("nextPage")}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : undefined}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-sm transition-colors",
            page >= totalPages
              ? "pointer-events-none text-muted-foreground/40 border-border/40"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </nav>
    </div>
  );
}
