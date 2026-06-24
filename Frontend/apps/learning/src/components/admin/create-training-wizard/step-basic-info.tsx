"use client";

import { Sparkles, ArrowRight, AlertTriangle, Monitor, MapPin } from "lucide-react";
import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@repo/ui";
import type { WizardState } from "@/types/admin-props";
import type { TrainingType } from "@/types";

const BADGE_LEVELS = ["Bronze", "Silver", "Gold"];
const TRAINING_TYPES: { value: TrainingType; label: string; description: string; icon: typeof Monitor }[] = [
  { value: "ELearning", label: "E-Learning", description: "Online self-paced training with chapters and content", icon: Monitor },
  { value: "OnSite", label: "On-Site", description: "In-person training with PDF course materials", icon: MapPin },
];

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
        {/* Training Type Selector */}
        <div className="col-span-3">
          <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Training Type</p>
            <div className="grid grid-cols-2 gap-3">
              {TRAINING_TYPES.map((t) => {
                const Icon = t.icon;
                const isActive = wizard.trainingType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => wizard.setTrainingType(t.value)}
                    aria-pressed={isActive}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                      isActive
                        ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-foreground" : "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${isActive ? "text-background" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{t.label}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-2 rounded-2xl border border-border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="wizard-title" className="text-[13px] font-semibold">Title <span className="text-destructive">*</span></Label>
              <Input id="wizard-title" value={wizard.title} onChange={(e) => wizard.setTitle(e.target.value)} placeholder="e.g. Advanced React Patterns" maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard-description" className="text-[13px] font-semibold">Description</Label>
              <textarea
                id="wizard-description"
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
                <Label htmlFor="wizard-category" className="text-[13px] font-semibold">Category <span className="text-destructive">*</span></Label>
                <Select value={wizard.categoryId} onValueChange={wizard.setCategoryId}>
                  <SelectTrigger id="wizard-category"><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {wizard.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard-badge-level" className="text-[13px] font-semibold">Badge Level</Label>
                <Select value={wizard.badgeLevel} onValueChange={wizard.setBadgeLevel}>
                  <SelectTrigger id="wizard-badge-level"><SelectValue /></SelectTrigger>
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
          className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
            wizard.canAdvanceStep1
              ? "ey-bg-dark text-white hover:opacity-90 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          Continue to Details <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
