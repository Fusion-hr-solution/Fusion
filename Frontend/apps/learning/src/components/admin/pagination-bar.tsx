"use client";

import { Button } from "@repo/ui";
import { useTranslations, useFormatter } from "next-intl";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
}: PaginationBarProps) {
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {t("pagination.showing", {
          from: format.number((page - 1) * pageSize + 1),
          to: format.number(Math.min(page * pageSize, totalCount)),
          total: format.number(totalCount),
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {tCommon("actions.previous")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("pagination.pageOf", {
            page: format.number(page),
            totalPages: format.number(totalPages),
          })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {tCommon("actions.next")}
        </Button>
      </div>
    </div>
  );
}
