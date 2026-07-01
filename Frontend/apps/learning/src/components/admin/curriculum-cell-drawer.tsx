"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X, Trash2, Plus, Loader2, Check } from "lucide-react";
import { Button, Badge, Checkbox, Card, CardContent, Label } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getCurriculumCell,
  removeCurriculumMapping,
  updateCurriculumMapping,
  addCurriculumMapping,
  getAdminTrainings,
} from "@/services/admin-service";
import type {
  AdminCurriculumMapping,
  AddCurriculumMappingInput,
} from "@/types/admin";

interface CurriculumCellDrawerProps {
  gradeId: string;
  serviceLineId: string;
  gradeName: string;
  serviceLineName: string;
  onClose: () => void;
  onChanged: () => void;
}

export function CurriculumCellDrawer({
  gradeId,
  serviceLineId,
  gradeName,
  serviceLineName,
  onClose,
  onChanged,
}: CurriculumCellDrawerProps) {
  const t = useTranslations("adminCurriculum");
  const tCommon = useTranslations("common");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTrainingId, setSelectedTrainingId] = useState("");
  const [selectedRequired, setSelectedRequired] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Dialog a11y: focus the panel on open and close on Escape.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fetchCell = useCallback(
    () => getCurriculumCell(gradeId, serviceLineId),
    [gradeId, serviceLineId]
  );
  const {
    data: mappings,
    isLoading,
    refetch,
  } = useApiQuery<AdminCurriculumMapping[]>(fetchCell, { enabled: true });

  const fetchTrainings = useCallback(
    () => getAdminTrainings({ pageSize: 200 }),
    []
  );
  const { data: trainingsData } = useApiQuery(fetchTrainings, {
    enabled: showAdd,
  });

  const { mutateAsync: doRemove } = useApiMutation(
    (id: string) => removeCurriculumMapping(id),
    {
      onSuccess: () => {
        refetch();
        onChanged();
      },
    }
  );

  const { mutateAsync: doToggleRequired } = useApiMutation(
    ({ id, isRequired }: { id: string; isRequired: boolean }) =>
      updateCurriculumMapping(id, isRequired),
    {
      onSuccess: () => {
        refetch();
        onChanged();
      },
    }
  );

  const { mutateAsync: doAdd, isLoading: adding } = useApiMutation(
    (input: AddCurriculumMappingInput) => addCurriculumMapping(input),
    {
      onSuccess: () => {
        setShowAdd(false);
        setSelectedTrainingId("");
        refetch();
        onChanged();
      },
    }
  );

  const handleRemove = useCallback(
    async (m: AdminCurriculumMapping) => {
      if (!confirm(t("confirmRemove", { title: m.trainingTitle }))) return;
      await doRemove(m.id);
    },
    [doRemove, t]
  );

  const handleAdd = async () => {
    if (!selectedTrainingId) return;
    await doAdd({
      gradeId,
      serviceLineId,
      trainingId: selectedTrainingId,
      isRequired: selectedRequired,
    });
  };

  // Trainings already in this cell
  const usedTrainingIds = new Set(mappings?.map((m) => m.trainingId) ?? []);
  const availableTrainings = (trainingsData?.trainings ?? []).filter(
    (t) => !usedTrainingIds.has(t.id)
  );

  const sorted =
    mappings?.slice().sort((a, b) => a.orderIndex - b.orderIndex) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="curriculum-drawer-title"
        className="relative z-10 flex w-full max-w-md flex-col bg-background shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 id="curriculum-drawer-title" className="text-sm font-semibold">
              {gradeName} × {serviceLineName}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("formationsCount", { count: sorted.length })}
            </p>
          </div>
          <Button ref={closeRef} variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {tCommon("actions.loading")}
            </p>
          ) : sorted.length === 0 && !showAdd ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("noFormationsAssigned")}
            </p>
          ) : (
            sorted.map((m) => (
              <Card key={m.id} className="border-border/60">
                <CardContent className="p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.trainingTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {t("creditsShort", { count: m.trainingCredits })}
                      </Badge>
                      <Badge
                        variant={m.isRequired ? "default" : "outline"}
                        className="text-xs"
                      >
                        {m.isRequired ? t("required") : t("optional")}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        doToggleRequired({
                          id: m.id,
                          isRequired: !m.isRequired,
                        })
                      }
                      aria-label={t("toggleRequiredAria", {
                        title: m.trainingTitle,
                      })}
                      className="h-7 w-7 p-0"
                    >
                      <Check
                        className={`h-3.5 w-3.5 ${m.isRequired ? "text-[hsl(var(--ey-green-500))]" : "text-muted-foreground"}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(m)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Add formation */}
          {showAdd && (
            <Card className="border-[hsl(var(--ey-blue-400))]/30 border-2">
              <CardContent className="p-3 space-y-2">
                <Label className="text-xs">{t("selectTrainingLabel")}</Label>
                <select
                  value={selectedTrainingId}
                  onChange={(e) => setSelectedTrainingId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">{t("chooseTrainingOption")}</option>
                  {availableTrainings.map((training) => (
                    <option key={training.id} value={training.id}>
                      {t("trainingOption", {
                        title: training.title,
                        type:
                          training.trainingType === "OnSite"
                            ? tCommon("trainingType.OnSite")
                            : tCommon("trainingType.ELearning"),
                      })}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-required"
                    checked={selectedRequired}
                    onCheckedChange={(c) => setSelectedRequired(c === true)}
                  />
                  <Label
                    htmlFor="add-required"
                    className="text-xs cursor-pointer"
                  >
                    {t("required")}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!selectedTrainingId || adding}
                    onClick={handleAdd}
                    className="ey-bg-dark hover:opacity-90"
                  >
                    {adding && (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    )}
                    {tCommon("actions.add")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdd(false)}
                  >
                    {tCommon("actions.cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setShowAdd(true)}
            disabled={showAdd}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> {t("addFormation")}
          </Button>
        </div>
      </div>
    </div>
  );
}
