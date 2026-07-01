"use client";

import { useTranslations } from "next-intl";
import {
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import type { TrainingFormBasicStepProps } from "@/types/admin-props";
import type { TrainingType } from "@/types";

const BADGE_LEVELS: {
  value: string;
  labelKey: "bronze" | "silver" | "gold";
}[] = [
  { value: "Bronze", labelKey: "bronze" },
  { value: "Silver", labelKey: "silver" },
  { value: "Gold", labelKey: "gold" },
];
const TRAINING_TYPES: {
  value: TrainingType;
  labelKey: "eLearningLabel" | "onSiteLabel";
  descriptionKey: "eLearningDescription" | "onSiteDescription";
}[] = [
  {
    value: "ELearning",
    labelKey: "eLearningLabel",
    descriptionKey: "eLearningDescription",
  },
  {
    value: "OnSite",
    labelKey: "onSiteLabel",
    descriptionKey: "onSiteDescription",
  },
];

export function TrainingFormBasicStep({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  categoryId,
  onCategoryChange,
  categories,
  badgeLevel,
  onBadgeLevelChange,
  trainingType,
  onTrainingTypeChange,
  fieldErrors = {},
}: TrainingFormBasicStepProps) {
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{t("form.basic.heading")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{t("form.basic.trainingTypeLabel")}</Label>
          <div className="grid grid-cols-2 gap-3">
            {TRAINING_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => onTrainingTypeChange(type.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  trainingType === type.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-medium">
                  {t(`form.basic.types.${type.labelKey}`)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t(`form.basic.types.${type.descriptionKey}`)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">{t("form.basic.titleLabel")}</Label>
          <Input
            id="title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t("form.basic.titlePlaceholder")}
            className={fieldErrors.title ? "border-destructive" : ""}
          />
          {fieldErrors.title && (
            <p className="text-xs text-destructive">{fieldErrors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            {t("form.basic.descriptionLabel")}
          </Label>
          <textarea
            id="description"
            maxLength={2000}
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("form.basic.descriptionPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">{t("form.basic.categoryLabel")}</Label>
            <select
              id="category"
              required
              className={`flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${fieldErrors.categoryId ? "border-destructive" : "border-input"}`}
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">{t("form.basic.selectCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p className="text-xs text-destructive">
                {fieldErrors.categoryId}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="badgeLevel">
              {t("form.basic.badgeLevelLabel")}
            </Label>
            <select
              id="badgeLevel"
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={badgeLevel}
              onChange={(e) => onBadgeLevelChange(e.target.value)}
            >
              {BADGE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {tCommon(`badgeLevel.${l.labelKey}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
