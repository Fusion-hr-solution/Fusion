"use client";

import Link from "next/link";
import { useTrainingWizard } from "@/hooks/use-training-wizard";
import { WizardStepper } from "./wizard-stepper";
import { StepBasicInfo } from "./step-basic-info";
import { StepDetails } from "./step-details";
import { StepChapters } from "./step-chapters";
import { StepReview } from "./step-review";

export function CreateTrainingWizard() {
  const wizard = useTrainingWizard({ mode: "create" });

  const isOnSite = wizard.trainingType === "OnSite";

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-background px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Create Training
            </h1>
            <p className="text-xs text-muted-foreground">
              {isOnSite ? "Set up a new on-site training program" : "Set up a new training program with chapters"}
            </p>
          </div>
          <Link
            href="/admin/trainings"
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
            {wizard.step === 3 && !isOnSite && <StepChapters wizard={wizard} />}
            {((wizard.step === 4) || (wizard.step === 3 && isOnSite)) && <StepReview wizard={wizard} />}
          </div>
        </div>
      </div>
    </div>
  );
}
