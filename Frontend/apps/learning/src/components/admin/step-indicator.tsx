import { Check } from "lucide-react";
import type { StepIndicatorProps } from "@/types/admin-props";

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? "border-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))] text-white"
                    : isCurrent
                      ? "border-[hsl(var(--ey-black))] bg-[hsl(var(--ey-black))] text-white shadow-md"
                      : "border-border bg-white text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4.5 w-4.5" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{step.icon}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  isCompleted || isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`mx-3 mb-5 h-0.5 w-12 rounded-full transition-colors duration-300 sm:w-20 ${
                  index < currentStep
                    ? "bg-[hsl(var(--ey-green-500))]"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
