"use client";

import { Check } from "lucide-react";

const ELEARNING_STEPS = [
  { label: "Basic Info", sub: "Title & category" },
  { label: "Details", sub: "Credits & duration" },
  { label: "Chapters", sub: "Build content" },
  { label: "Review", sub: "Final check" },
];

const ONSITE_STEPS = [
  { label: "Basic Info", sub: "Title & category" },
  { label: "Details", sub: "Credits & schedule" },
  { label: "Review", sub: "Final check" },
];

interface WizardStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  isOnSite?: boolean;
}

export function WizardStepper({ currentStep, onStepClick, isOnSite }: WizardStepperProps) {
  const STEPS = isOnSite ? ONSITE_STEPS : ELEARNING_STEPS;
  return (
    <div className="border-b border-border px-8 py-5">
      <div className="mx-auto flex w-full max-w-3xl items-center">
        {STEPS.map((s, i) => {
          const num = i + 1;
          const isActive = currentStep === num;
          const isDone = currentStep > num;

          return (
            <div key={s.label} className="flex flex-1 items-center">
              {i > 0 && (
                <div
                  className={`h-[2px] flex-1 rounded-full transition-all duration-500 ${
                    currentStep > i ? "bg-foreground" : "bg-border"
                  }`}
                />
              )}

              <div className="flex flex-col items-center gap-1.5 px-2">
                <button
                  onClick={() => isDone && onStepClick(num)}
                  disabled={!isDone}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300 ${
                    isDone
                      ? "cursor-pointer bg-foreground text-background hover:opacity-80 hover:scale-105"
                      : isActive
                        ? "cursor-default bg-foreground text-background scale-110 shadow-[0_0_0_4px_hsl(var(--border))]"
                        : "cursor-default border-2 border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : num}
                  {isActive && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-foreground opacity-10" />
                  )}
                </button>

                <div className="text-center" style={{ minWidth: 72 }}>
                  <p
                    className={`text-[12px] font-semibold leading-tight transition-colors ${
                      isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] leading-tight ${
                      isDone ? "text-muted-foreground" : isActive ? "text-muted-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    {isDone ? "Complete ✓" : isActive ? "In progress" : s.sub}
                  </p>
                </div>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className={`h-[2px] flex-1 rounded-full transition-all duration-500 ${
                    currentStep > num ? "bg-foreground" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
