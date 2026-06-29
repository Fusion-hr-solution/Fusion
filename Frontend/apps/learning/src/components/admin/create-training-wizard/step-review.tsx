"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Send,
} from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";
import type { WizardState } from "@/types/admin-props";

interface StepReviewProps {
  wizard: WizardState;
}

function ReviewCard({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const tCommon = useTranslations("common");
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
            {step}
          </span>
          <p className="text-[14px] font-bold text-foreground">{title}</p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> {tCommon("actions.edit")}
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[13px] font-medium text-foreground">
        {value || (
          <span className="font-normal text-muted-foreground/50">—</span>
        )}
      </p>
    </div>
  );
}

export function StepReview({ wizard }: StepReviewProps) {
  const t = useTranslations("adminWizard");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const checks = [
    { label: t("review.checks.titleAdded"), pass: wizard.title.trim() !== "" },
    {
      label: t("review.checks.categorySelected"),
      pass: wizard.categoryId !== "",
    },
    ...(wizard.trainingType === "OnSite"
      ? []
      : [
          {
            label: t("review.checks.chapterAdded"),
            pass: wizard.chapters.length > 0,
          },
        ]),
  ];
  const isReady = checks.every((c) => c.pass);

  async function handlePublish() {
    setActionMessage(null);
    try {
      await wizard.handleSubmit();
    } catch {
      setActionMessage(
        wizard.mode === "edit"
          ? t("review.failedToUpdate")
          : t("review.failedToCreate")
      );
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
            <ClipboardCheck className="h-3.5 w-3.5 text-background" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {wizard.mode === "edit"
              ? t("review.headingEdit")
              : t("review.headingCreate")}
          </h2>
        </div>
        <p className="ml-9 text-[13px] text-muted-foreground">
          {wizard.mode === "edit"
            ? t("review.subtitleEdit")
            : t("review.subtitleCreate")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          <ReviewCard
            title={t("review.card.basicInfo")}
            step={1}
            onEdit={() => wizard.setStep(1)}
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Pair
                label={t("review.labels.trainingType")}
                value={
                  wizard.trainingType === "OnSite"
                    ? t("basic.types.onSiteLabel")
                    : t("basic.types.eLearningLabel")
                }
              />
              <Pair label={t("review.labels.title")} value={wizard.title} />
              <Pair
                label={t("review.labels.category")}
                value={wizard.categoryName}
              />
              <Pair
                label={t("review.labels.badgeLevel")}
                value={wizard.badgeLevel}
              />
            </div>
            {wizard.description && (
              <div className="mt-4 border-t border-border pt-4">
                <Pair
                  label={t("review.labels.description")}
                  value={wizard.description}
                />
              </div>
            )}
          </ReviewCard>

          <ReviewCard
            title={t("review.card.details")}
            step={2}
            onEdit={() => wizard.setStep(2)}
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Pair
                label={t("review.labels.credits")}
                value={format.number(wizard.credits)}
              />
              <Pair
                label={t("review.labels.duration")}
                value={wizard.duration || null}
              />
              <Pair
                label={t("review.labels.mandatory")}
                value={wizard.isMandatory ? t("review.yes") : t("review.no")}
              />
              {wizard.trainingType === "OnSite" && wizard.scheduledDate && (
                <Pair
                  label={t("review.labels.scheduledDate")}
                  value={format.dateTime(new Date(wizard.scheduledDate), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              )}
              {wizard.trainingType === "OnSite" && <Pair label="Cost Type" value={wizard.costType} />}
              {wizard.trainingType === "OnSite" && wizard.costType === "External" && (
                <Pair
                  label="Sponsoring Service Line"
                  value={wizard.serviceLines.find((sl) => sl.id === wizard.sponsoringServiceLineId)?.name ?? "—"}
                />
              )}
            </div>
          </ReviewCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {wizard.trainingType !== "OnSite" && (
            <ReviewCard
              title={t("review.card.chapters", {
                count: wizard.chapters.length,
              })}
              step={3}
              onEdit={() => wizard.setStep(3)}
            >
              {wizard.chapters.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {t("review.noChapters")}
                </p>
              ) : (
                <div className="space-y-2">
                  {wizard.chapters.map((ch, i) => (
                    <div
                      key={ch.clientId}
                      className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                        {ch.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {ch.layout}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ReviewCard>
          )}

          {/* Readiness */}
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <p className="text-[14px] font-bold text-foreground">
                {t("review.readinessHeading")}
              </p>
            </div>
            <div className="px-6 py-5">
              <div className="mb-4">
                <span
                  className={`rounded-xl px-4 py-1.5 text-[13px] font-bold ${isReady ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                >
                  {isReady
                    ? wizard.mode === "edit"
                      ? t("review.readyToSave")
                      : t("review.readyToCreate")
                    : t("review.needsAttention")}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {checks.map((check) => (
                  <div
                    key={check.label}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${check.pass ? "bg-muted/50" : "bg-destructive/5"}`}
                  >
                    {check.pass ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span
                      className={`flex-1 text-[13px] font-medium ${check.pass ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <button
          onClick={() =>
            wizard.setStep(wizard.trainingType === "OnSite" ? 2 : 3)
          }
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {tCommon("actions.back")}
        </button>
        <button
          onClick={() => void handlePublish()}
          disabled={!isReady || wizard.isSubmitting}
          className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm transition-all ${
            isReady && !wizard.isSubmitting
              ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          {wizard.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {wizard.isSubmitting
            ? wizard.mode === "edit"
              ? t("review.saving")
              : t("review.creating")
            : wizard.mode === "edit"
              ? t("review.saveChanges")
              : t("review.createTraining")}
        </button>
      </div>
      {(actionMessage || wizard.formError) && (
        <p className="mt-3 text-sm text-destructive">
          {actionMessage ?? wizard.formError}
        </p>
      )}
    </div>
  );
}
