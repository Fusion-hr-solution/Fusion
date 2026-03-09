import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/config/constants";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  currentStep: number;
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center w-full">
      {WIZARD_STEPS.map((step, idx) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isLast = idx === WIZARD_STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full font-semibold transition-all duration-700",
                  isActive ? "w-12 h-12 bg-zinc-900 text-white ring-4 ring-zinc-200 scale-110 text-base" : "w-10 h-10 text-sm",
                  isCompleted ? "bg-zinc-900 text-white" : !isActive ? "bg-zinc-100 text-zinc-500 border border-zinc-200" : ""
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : step.id}
              </div>
              <div className="text-center">
                <p className={cn("text-xs font-medium whitespace-nowrap transition-colors duration-300",
                  isActive ? "text-zinc-900" : isCompleted ? "text-zinc-600" : "text-zinc-400"
                )}>
                  {step.label}
                </p>
                {isActive && (
                  <p className="text-[10px] text-zinc-400 mt-0.5">In progress</p>
                )}
              </div>
            </div>

            {!isLast && (
              <div className="flex-1 mx-3 mb-5">
                <div className="h-[3px] rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all duration-700"
                    style={{ width: isCompleted ? "100%" : "0%" }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}