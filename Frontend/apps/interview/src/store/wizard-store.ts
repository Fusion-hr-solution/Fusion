"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WizardFormState, Question } from "@/types";

const INITIAL_BASIC_INFO: WizardFormState["basicInfo"] = {
  title: "",
  role: "",
  discipline: "",
  description: "",
  internalNotes: "",
  estimatedDuration: 60,
  difficultyLevel: "",
};

const INITIAL_CONFIG: WizardFormState["config"] = {
  allowSkipping: false,
  showProgressBar: true,
  restrictCopyPaste: false,
  enableProctoring: false,
  enableTimeLimit: false,
  timeLimitMinutes: 60,
  maxAttempts: 1,
  randomizeOrder: false,
  accessType: "invitation",
  startDate: "",
  endDate: "",
  linkExpiry: 7,
  passingThreshold: 70,
  allowPartialCredit: false,
  assignedReviewer: "",
};

interface WizardStore {
  step: number;
  testId: string | null;
  basicInfo: WizardFormState["basicInfo"];
  selectedQuestions: Question[];
  previewFlaggedQuestionIds: string[];
  config: WizardFormState["config"];
  isDirty: boolean;
  lastSaved: number | null;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateBasicInfo: (updates: Partial<WizardFormState["basicInfo"]>) => void;
  updateConfig: (updates: Partial<WizardFormState["config"]>) => void;
  addQuestion: (q: Question) => void;
  updateSelectedQuestion: (q: Question) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (qs: Question[]) => void;
  isQuestionSelected: (id: string) => boolean;
  setPreviewFlaggedQuestionIds: (ids: string[]) => void;
  togglePreviewFlaggedQuestion: (id: string) => void;
  setPersistedTestId: (id: string | null) => void;
  markSaved: () => void;
  reset: () => void;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set, get) => ({
      step: 1,
      testId: null,
      basicInfo: INITIAL_BASIC_INFO,
      selectedQuestions: [],
      previewFlaggedQuestionIds: [],
      config: INITIAL_CONFIG,
      isDirty: false,
      lastSaved: null,
      setStep: (step) => set({ step }),
      nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 4) })),
      prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
      updateBasicInfo: (updates) =>
        set((s) => ({ basicInfo: { ...s.basicInfo, ...updates }, isDirty: true })),
      updateConfig: (updates) =>
        set((s) => ({ config: { ...s.config, ...updates }, isDirty: true })),
      addQuestion: (q) =>
        set((s) => ({ selectedQuestions: [...s.selectedQuestions, q], isDirty: true })),
      updateSelectedQuestion: (q) =>
        set((s) => ({
          selectedQuestions: s.selectedQuestions.map((existing) =>
            existing.id === q.id ? q : existing
          ),
          isDirty: true,
        })),
      removeQuestion: (id) =>
        set((s) => ({
          selectedQuestions: s.selectedQuestions.filter((q) => q.id !== id),
          previewFlaggedQuestionIds: s.previewFlaggedQuestionIds.filter((qId) => qId !== id),
          isDirty: true,
        })),
      reorderQuestions: (qs) => set({ selectedQuestions: qs, isDirty: true }),
      isQuestionSelected: (id) => get().selectedQuestions.some((q) => q.id === id),
      setPreviewFlaggedQuestionIds: (ids) =>
        set({ previewFlaggedQuestionIds: Array.from(new Set(ids)) }),
      togglePreviewFlaggedQuestion: (id) =>
        set((s) => ({
          previewFlaggedQuestionIds: s.previewFlaggedQuestionIds.includes(id)
            ? s.previewFlaggedQuestionIds.filter((qId) => qId !== id)
            : [...s.previewFlaggedQuestionIds, id],
        })),
      setPersistedTestId: (id) => set({ testId: id }),
      markSaved: () => set({ isDirty: false, lastSaved: Date.now() }),
      reset: () =>
        set({
          step: 1,
          testId: null,
          basicInfo: INITIAL_BASIC_INFO,
          selectedQuestions: [],
          previewFlaggedQuestionIds: [],
          config: INITIAL_CONFIG,
          isDirty: false,
          lastSaved: null,
        }),
    }),
    {
      name: "fusion-wizard-state",
      partialize: (s) => ({
        testId: s.testId,
        basicInfo: s.basicInfo,
        selectedQuestions: s.selectedQuestions,
        previewFlaggedQuestionIds: s.previewFlaggedQuestionIds,
        config: s.config,
        step: s.step,
      }),
    }
  )
);