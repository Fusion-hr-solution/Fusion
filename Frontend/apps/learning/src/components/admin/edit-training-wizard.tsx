"use client";

import Link from "next/link";
import { useEditTrainingWizard } from "@/hooks/use-edit-training-wizard";
import { WizardStepper } from "./create-training-wizard/wizard-stepper";
import { StepBasicInfo } from "./create-training-wizard/step-basic-info";
import { StepDetails } from "./create-training-wizard/step-details";
import { StepChapters } from "./create-training-wizard/step-chapters";
import { StepReview } from "./create-training-wizard/step-review";

interface EditTrainingWizardProps {
  trainingId: string;
}

export function EditTrainingWizard({ trainingId }: EditTrainingWizardProps) {
  const wizard = useEditTrainingWizard(trainingId);
  const isOnSite = wizard.trainingType === "OnSite";

  if (wizard.loadingDetail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading training...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-background px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Edit Training
            </h1>
            <p className="text-xs text-muted-foreground">
              {isOnSite ? "Update training details and courses" : "Update training details and manage chapters"}
            </p>
          </div>
          <Link
            href={`/admin/trainings/${trainingId}`}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Stepper */}
      <div className="shrink-0 bg-background">
        <WizardStepper currentStep={wizard.step} onStepClick={wizard.setStep} isOnSite={isOnSite} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-8 py-8">
          <div key={wizard.step} className="ey-animate-fade-up">
            {wizard.step === 1 && <StepBasicInfo wizard={wizard} />}
            {wizard.step === 2 && <StepDetails wizard={wizard} />}
            {wizard.step === 3 && !isOnSite && <StepChapters wizard={wizard} trainingId={trainingId} />}
            {((wizard.step === 4) || (wizard.step === 3 && isOnSite)) && <StepReview wizard={wizard} />}
          </div>
        </div>
      </div>
    </div>
  );
}
