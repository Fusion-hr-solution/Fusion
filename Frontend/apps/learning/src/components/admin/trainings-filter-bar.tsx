"use client";

import {
  Button,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Checkbox,
} from "@repo/ui";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AdminCategory } from "@/types/admin";
import { SearchInput } from "../search-input";

interface TrainingsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  includeDeleted: boolean;
  onIncludeDeletedChange: (value: boolean) => void;
  categories: AdminCategory[];
  onRefresh: () => void;
}

export function TrainingsFilterBar({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  includeDeleted,
  onIncludeDeletedChange,
  categories,
  onRefresh,
}: TrainingsFilterBarProps) {
  const t = useTranslations("adminTrainings");
  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={t("filter.searchPlaceholder")}
            ariaLabel={t("filter.searchAriaLabel")}
          />
        </div>
        <Select
          value={categoryId || "all"}
          onValueChange={(v) => onCategoryChange(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder={t("filter.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={includeDeleted}
            onCheckedChange={(checked) =>
              onIncludeDeletedChange(checked === true)
            }
          />
          {t("filter.showDeleted")}
        </label>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t("filter.refresh")}
        </Button>
      </CardContent>
    </Card>
  );
}
