"use client";

import { Settings2, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { Input, Label, Checkbox } from "@repo/ui";
import type { WizardState } from "@/types/admin-props";

interface StepDetailsProps {
  wizard: WizardState;
}

export function StepDetails({ wizard }: StepDetailsProps) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
            <Settings2 className="h-3.5 w-3.5 text-background" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Additional Details</h2>
        </div>
        <p className="ml-9 text-[13px] text-muted-foreground">
          Configure credits, duration, and compliance requirements
        </p>
      </div>

      {wizard.formError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{wizard.formError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Credits & Duration */}
        <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Effort & Reward
          </p>
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Credits Earned</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={wizard.credits}
                  onChange={(e) => wizard.setCredits(Number(e.target.value) || 0)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">points</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Credits awarded on successful completion</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Estimated Duration</Label>
              <Input
                value={wizard.duration}
                onChange={(e) => wizard.setDuration(e.target.value)}
                placeholder="e.g. 2 hours, 45 minutes"
              />
              <p className="text-[11px] text-muted-foreground">Approximate time to complete all chapters</p>
            </div>
          </div>
        </div>

        {/* Compliance */}
        <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Compliance
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <Checkbox
              id="mandatory"
              checked={wizard.isMandatory}
              onCheckedChange={(c) => wizard.setIsMandatory(c === true)}
              className="mt-0.5"
            />
            <div>
              <label htmlFor="mandatory" className="text-[13px] font-semibold text-foreground cursor-pointer">
                Mark as mandatory
              </label>
              <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                Mandatory trainings are automatically assigned to all employees and tracked for compliance reporting.
              </p>
            </div>
          </div>

          {wizard.trainingType === "OnSite" && (
            <div className="mt-5 space-y-2">
              <Label className="text-[13px] font-semibold">Scheduled Date & Time</Label>
              <Input
                type="datetime-local"
                value={wizard.scheduledDate}
                onChange={(e) => wizard.setScheduledDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              {wizard.scheduledDate && new Date(wizard.scheduledDate) <= new Date() && (
                <p className="text-[11px] text-destructive font-medium">Scheduled date must be in the future</p>
              )}
              <p className="text-[11px] text-muted-foreground">When the on-site training session will take place</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <button
          onClick={wizard.prevStep}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={wizard.handleNext}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
        >
          Continue to {wizard.trainingType === "OnSite" ? "Review" : "Chapters"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
