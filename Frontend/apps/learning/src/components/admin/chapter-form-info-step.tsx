"use client";

import { useTranslations } from "next-intl";
import {
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@repo/ui";
import type { ChapterFormInfoStepProps } from "@/types/admin-props";

const CONTENT_TYPE_VALUES = ["Article", "Pdf", "Video", "Exercise"] as const;

export function ChapterFormInfoStep({
  title,
  onTitleChange,
  contentType,
  onContentTypeChange,
  orderIndex,
  onOrderIndexChange,
  fieldErrors = {},
}: ChapterFormInfoStepProps) {
  const t = useTranslations("adminChapters");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ch-title">{t("infoStep.titleLabel")}</Label>
        <Input
          id="ch-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("infoStep.titlePlaceholder")}
          className={fieldErrors.title ? "border-destructive" : ""}
        />
        {fieldErrors.title && (
          <p className="text-xs text-destructive">{fieldErrors.title}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("infoStep.contentTypeLabel")}</Label>
          <Select value={contentType} onValueChange={onContentTypeChange}>
            <SelectTrigger
              className={fieldErrors.contentType ? "border-destructive" : ""}
            >
              <SelectValue placeholder={t("infoStep.selectType")} />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPE_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`infoStep.contentType.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ch-order">{t("infoStep.orderIndexLabel")}</Label>
          <Input
            id="ch-order"
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => onOrderIndexChange(Number(e.target.value))}
            className={fieldErrors.orderIndex ? "border-destructive" : ""}
          />
          {fieldErrors.orderIndex && (
            <p className="text-xs text-destructive">{fieldErrors.orderIndex}</p>
          )}
        </div>
      </div>
    </div>
  );
}
