"use client";

import { Check } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Basic Info",    sub: "Name & details"     },
  { label: "Questions",     sub: "Build question set"  },
  { label: "Configuration", sub: "Settings & access"  },
  { label: "Review",        sub: "Final check"         },
];

export function Stepper() {
  const { step, setStep } = useWizardStore();

  return (
    <div className="border-b border-zinc-100 bg-white px-8 py-4 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
      <div className="mx-auto flex w-full max-w-4xl items-center">
        {STEPS.map((s, i) => {
          const num      = i + 1;
          const isActive = step === num;
          const isDone   = step > num;

          return (
            <div key={s.label} className="flex flex-1 items-center">
              {/* Left connector */}
              {i > 0 && (
                <div className={cn(
                  "h-[2px] flex-1 rounded-full transition-all duration-500",
                  step > i ? "bg-zinc-900" : "bg-zinc-100"
                )} />
              )}

              {/* Node + label */}
              <div className="flex flex-col items-center gap-1.5 px-2">
                <button
                  onClick={() => isDone && setStep(num)}
                  disabled={!isDone}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300",
                    isDone   ? "cursor-pointer bg-zinc-900 text-white hover:bg-zinc-700 hover:scale-105" :
                    isActive ? "cursor-default bg-zinc-900 text-white scale-110 shadow-[0_0_0_4px_rgba(0,0,0,0.08)]" :
                               "cursor-default border-2 border-zinc-200 bg-white text-zinc-300"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : num}
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-zinc-900 animate-ping opacity-10" />
                  )}
                </button>

                <div className="text-center" style={{ minWidth: 72 }}>
                  <p className={cn(
                    "text-[12px] font-semibold leading-tight transition-colors duration-150",
                    isActive ? "text-zinc-900" : isDone ? "text-zinc-500" : "text-zinc-400"
                  )}>
                    {s.label}
                  </p>
                  <p className={cn(
                    "mt-0.5 text-[10px] leading-tight",
                    isDone ? "text-zinc-400" : isActive ? "text-zinc-400" : "text-zinc-300"
                  )}>
                    {isDone ? "Complete ✓" : isActive ? "In progress" : s.sub}
                  </p>
                </div>
              </div>

              {/* Right connector */}
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-[2px] flex-1 rounded-full transition-all duration-500",
                  step > num ? "bg-zinc-900" : "bg-zinc-100"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}