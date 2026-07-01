"use client";

import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  FileText,
  Settings,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent } from "@repo/ui";
import type { TrainingFormProps } from "@/types/admin-props";
import { useTrainingForm } from "@/hooks/use-training-form";
import { StepIndicator } from "./step-indicator";
import { TrainingFormBasicStep } from "./training-form-basic-step";
import { TrainingFormDetailsStep } from "./training-form-details-step";
import { TrainingFormReviewStep } from "./training-form-review-step";
import { PageBreadcrumb } from "../page-breadcrumb";

const STEP_ICONS = [
  <FileText key="basic" className="h-4 w-4" />,
  <Settings key="details" className="h-4 w-4" />,
  <CheckCircle2 key="review" className="h-4 w-4" />,
];
const STEP_COUNT = 3;

export function TrainingForm({ trainingId }: TrainingFormProps) {
  const router = useRouter();
  const t = useTranslations("adminTrainings");
  const tCommon = useTranslations("common");

  const steps = [
    { label: t("form.steps.basicInfo"), icon: STEP_ICONS[0] },
    { label: t("form.steps.details"), icon: STEP_ICONS[1] },
    { label: t("form.steps.review"), icon: STEP_ICONS[2] },
  ];

  const form = useTrainingForm({
    trainingId,
    enabled: true,
    onCreated: () => router.push("/admin/trainings"),
    onUpdated: () => router.push(`/admin/trainings/${trainingId}`),
  });

  if (form.isEditing && form.loadingDetail) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        {t("form.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageBreadcrumb
        backHref="/admin/trainings"
        backLabel={tCommon("actions.back")}
        items={[
          { label: t("form.manageTrainings"), href: "/admin/trainings" },
          {
            label: form.isEditing
              ? t("form.editTraining")
              : t("form.newTraining"),
          },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {form.isEditing ? t("form.editTraining") : t("form.createTraining")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("form.stepOf", { current: form.step + 1, total: STEP_COUNT })}
        </p>
      </div>

      {form.formError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{form.formError}</span>
        </div>
      )}

      <Card className="border-border/60">
        <CardContent className="py-6">
          <StepIndicator steps={steps} currentStep={form.step} />
        </CardContent>
      </Card>

      {form.step === 0 && (
        <TrainingFormBasicStep
          title={form.title}
          onTitleChange={(v) => {
            form.setTitle(v);
            form.clearFieldError("title");
          }}
          description={form.description}
          onDescriptionChange={form.setDescription}
          categoryId={form.categoryId}
          onCategoryChange={(v) => {
            form.setCategoryId(v);
            form.clearFieldError("categoryId");
          }}
          categories={form.categories}
          badgeLevel={form.badgeLevel}
          onBadgeLevelChange={form.setBadgeLevel}
          trainingType={form.trainingType}
          onTrainingTypeChange={form.setTrainingType}
          fieldErrors={form.fieldErrors}
        />
      )}

      {form.step === 1 && (
        <TrainingFormDetailsStep
          credits={form.credits}
          onCreditsChange={(v) => {
            form.setCredits(v);
            form.clearFieldError("credits");
          }}
          duration={form.duration}
          onDurationChange={form.setDuration}
          isMandatory={form.isMandatory}
          onMandatoryChange={form.setIsMandatory}
          trainingType={form.trainingType}
          scheduledDate={form.scheduledDate}
          onScheduledDateChange={form.setScheduledDate}
          costType={form.costType}
          onCostTypeChange={form.setCostType}
          sponsoringServiceLineId={form.sponsoringServiceLineId}
          onSponsoringServiceLineIdChange={(v) => {
            form.setSponsoringServiceLineId(v);
            form.clearFieldError("sponsoringServiceLineId");
          }}
          serviceLines={form.serviceLines}
          fieldErrors={form.fieldErrors}
        />
      )}

      {form.step === 2 && (
        <TrainingFormReviewStep
          title={form.title}
          description={form.description}
          categoryName={form.categoryName}
          badgeLevel={form.badgeLevel}
          credits={form.credits}
          duration={form.duration}
          isMandatory={form.isMandatory}
          trainingType={form.trainingType}
          scheduledDate={form.scheduledDate}
          costType={form.costType}
          sponsoringServiceLineName={form.sponsoringServiceLineName}
        />
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (form.step === 0) router.back();
            else form.setStep(form.step - 1);
          }}
        >
          {form.step === 0 ? (
            tCommon("actions.cancel")
          ) : (
            <>
              <ArrowLeft className="mr-1 h-4 w-4" />{" "}
              {tCommon("actions.previous")}
            </>
          )}
        </Button>

        {form.step < STEP_COUNT - 1 ? (
          <Button
            type="button"
            disabled={!form.canAdvance(form.step)}
            onClick={form.handleNext}
            className="ey-bg-dark hover:opacity-90"
          >
            {tCommon("actions.next")} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={form.isSaving}
            onClick={form.handleSubmit}
            className="ey-bg-dark hover:opacity-90"
          >
            {form.isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {form.isEditing
              ? t("form.updateTraining")
              : t("form.createTraining")}
          </Button>
        )}
      </div>
    </div>
  );
}
