"use client";

import { Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@repo/ui";
import type { WizardState } from "@/types/admin-props";

const BADGE_LEVELS = ["Bronze", "Silver", "Gold"];

interface StepBasicInfoProps {
  wizard: WizardState;
}

export function StepBasicInfo({ wizard }: StepBasicInfoProps) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
            <Sparkles className="h-3.5 w-3.5 text-background" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Training Details</h2>
        </div>
        <p className="ml-9 text-[13px] text-muted-foreground">
          Set the core information for this training program
        </p>
      </div>

      {wizard.formError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{wizard.formError}</span>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-2xl border border-border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Title <span className="text-destructive">*</span></Label>
              <Input value={wizard.title} onChange={(e) => wizard.setTitle(e.target.value)} placeholder="e.g. Advanced React Patterns" maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Description</Label>
              <textarea
                rows={4}
                value={wizard.description}
                onChange={(e) => wizard.setDescription(e.target.value)}
                placeholder="Describe what this training covers, its goals, and who it's for..."
                className="flex w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Classification</p>
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Category <span className="text-destructive">*</span></Label>
                <Select value={wizard.categoryId} onValueChange={wizard.setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {wizard.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Badge Level</Label>
                <Select value={wizard.badgeLevel} onValueChange={wizard.setBadgeLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BADGE_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex justify-end border-t border-border pt-6">
        <button
          onClick={wizard.handleNext}
          disabled={!wizard.canAdvanceStep1}
          className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
            wizard.canAdvanceStep1
              ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          Continue to Details <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
