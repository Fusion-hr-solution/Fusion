"use client";

import { useWizardStore } from "@/store/wizard-store";

export function useWizard() {
  const store = useWizardStore();

  const totalSteps = 4;

  function validateStep1(): boolean {
    return (
      store.basicInfo.title.trim() !== "" &&
      store.basicInfo.discipline !== ""
    );
  }

  const totalPoints = store.selectedQuestions.reduce(
    (sum, q) => sum + q.points,
    0
  );

  return {
    state: {
      step:              store.step,
      basicInfo:         store.basicInfo,
      selectedQuestions: store.selectedQuestions,
      config:            store.config,
    },
    errors:             {} as Record<string, string>,
    setErrors:          (_: Record<string, string>) => {},
    totalSteps,
    setStep:            store.setStep,
    nextStep:           store.nextStep,
    prevStep:           store.prevStep,
    updateBasicInfo:    store.updateBasicInfo,
    updateConfig:       store.updateConfig,
    addQuestion:        store.addQuestion,
    removeQuestion:     store.removeQuestion,
    reorderQuestions:   store.reorderQuestions,
    isQuestionSelected: store.isQuestionSelected,
    validateStep1,
    reset:              store.reset,
    totalPoints,
    isDirty:            store.isDirty,
    lastSaved:          store.lastSaved,
    markSaved:          store.markSaved,
  };
}