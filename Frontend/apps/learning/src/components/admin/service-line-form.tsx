"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, X } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Checkbox } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { createServiceLine, updateServiceLine } from "@/services/admin-service";
import type {
  AdminServiceLine,
  CreateServiceLineInput,
  UpdateServiceLineInput,
} from "@/types/admin";

interface ServiceLineFormProps {
  serviceLine?: AdminServiceLine;
  onSaved: () => void;
  onCancel: () => void;
}

export function ServiceLineForm({
  serviceLine,
  onSaved,
  onCancel,
}: ServiceLineFormProps) {
  const t = useTranslations("adminServiceLines");
  const tCommon = useTranslations("common");
  const isEditing = Boolean(serviceLine);
  const [name, setName] = useState(serviceLine?.name ?? "");
  const [code, setCode] = useState(serviceLine?.code ?? "");
  const [color, setColor] = useState(serviceLine?.color ?? "#2563eb");
  const [description, setDescription] = useState(
    serviceLine?.description ?? ""
  );
  const [isShared, setIsShared] = useState(
    serviceLine?.isSharedAcrossAllServiceLines ?? false
  );

  const { mutateAsync: doCreate, isLoading: creating } = useApiMutation(
    (input: CreateServiceLineInput) => createServiceLine(input),
    { onSuccess: onSaved }
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateServiceLineInput) =>
      updateServiceLine(serviceLine!.id, input),
    { onSuccess: onSaved }
  );

  const isSaving = creating || updating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      code,
      color,
      description: description || undefined,
      isSharedAcrossAllServiceLines: isShared,
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
              <Label htmlFor="sl-name" className="text-xs">
                {t("form.nameLabel")}
              </Label>
              <Input
                id="sl-name"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("form.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sl-code" className="text-xs">
                {t("form.codeLabel")}
              </Label>
              <Input
                id="sl-code"
                required
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("form.codePlaceholder")}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sl-color" className="text-xs">
                {t("form.colorLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="sl-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-border"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  maxLength={7}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sl-desc" className="text-xs">
                {t("form.descriptionLabel")}
              </Label>
              <Input
                id="sl-desc"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sl-shared"
              checked={isShared}
              onCheckedChange={(checked) => setIsShared(checked === true)}
            />
            <Label htmlFor="sl-shared" className="text-xs cursor-pointer">
              {t("form.sharedLabel")}
            </Label>
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
