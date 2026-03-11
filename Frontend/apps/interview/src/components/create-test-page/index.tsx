"use client";

import { useEffect, useRef } from "react";
import { useWizardStore } from "@/store/wizard-store";
import { TopBar } from "./top-bar";
import { Stepper } from "./stepper";
import { LivePreview } from "./live-preview";
import { StepBasicInfo } from "./step-basic-info";
import { StepQuestions } from "./step-questions";
import { StepConfig } from "./step-config";
import { StepReview } from "./step-review";
import { cn } from "@/lib/utils";

type StepComponent = () => React.JSX.Element;

const STEP_COMPONENTS: Record<number, StepComponent> = {
  1: StepBasicInfo,
  2: StepQuestions,
  3: StepConfig,
  4: StepReview,
};

const PREVIEW_WIDTH = 296;

export function CreateTestPage() {
  const { step, isDirty, markSaved } = useWizardStore();
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (isDirty) markSaved();
    }, 30_000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [isDirty, markSaved]);

  const ActiveStep: StepComponent = STEP_COMPONENTS[step] ?? StepBasicInfo;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50/40">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Main column — full width minus the preview panel */}
        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{ paddingRight: PREVIEW_WIDTH }}
        >
          {/* Sticky stepper */}
          <div className="shrink-0 bg-white">
            <Stepper />
          </div>

          {/* Scrollable step content — full width, generous px only */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full px-8 py-8">
              <div
                key={step}
                className={cn(
                  "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
                )}
              >
                <ActiveStep />
              </div>
            </div>
          </div>
        </div>

        {/* Live preview panel */}
        <LivePreview />
      </div>
    </div>
  );
}