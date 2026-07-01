"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, X } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { createGrade, updateGrade } from "@/services/admin-service";
import type {
  AdminGrade,
  CreateGradeInput,
  UpdateGradeInput,
} from "@/types/admin";

interface GradeFormProps {
  grade?: AdminGrade;
  onSaved: () => void;
  onCancel: () => void;
}

export function GradeForm({ grade, onSaved, onCancel }: GradeFormProps) {
  const t = useTranslations("adminGrades");
  const tCommon = useTranslations("common");
  const isEditing = Boolean(grade);
  const [name, setName] = useState(grade?.name ?? "");
  const [level, setLevel] = useState(grade?.level?.toString() ?? "");
  const [description, setDescription] = useState(grade?.description ?? "");
  const [icon, setIcon] = useState(grade?.icon ?? "");

  const { mutateAsync: doCreate, isLoading: creating } = useApiMutation(
    (input: CreateGradeInput) => createGrade(input),
    { onSuccess: onSaved }
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateGradeInput) => updateGrade(grade!.id, input),
    { onSuccess: onSaved }
  );

  const isSaving = creating || updating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const levelNum = Number(level);
    if (!Number.isInteger(levelNum) || levelNum < 1) return;
    const payload = {
      name,
      level: levelNum,
      description: description || undefined,
      icon: icon || undefined,
    };
    if (isEditing) await doUpdate(payload);
    else await doCreate(payload);
  }

  return (
    <Card className="border-[hsl(var(--ey-blue-400))]/30 border-2">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="grade-name" className="text-xs">
                {t("form.nameLabel")}
              </Label>
              <Input
                id="grade-name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("form.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grade-level" className="text-xs">
                {t("form.levelLabel")}
              </Label>
              <Input
                id="grade-level"
                required
                type="number"
                min={1}
                step={1}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder={t("form.levelPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade-desc" className="text-xs">
              {t("form.descriptionLabel")}
            </Label>
            <Input
              id="grade-desc"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade-icon" className="text-xs">
              {t("form.iconLabel")}
            </Label>
            <Input
              id="grade-icon"
              maxLength={50}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder={t("form.iconPlaceholder")}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="ey-bg-dark hover:opacity-90"
            >
              {isSaving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 h-3.5 w-3.5" />
              )}
              {isEditing ? t("form.update") : t("form.create")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="mr-1 h-3.5 w-3.5" /> {tCommon("actions.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
