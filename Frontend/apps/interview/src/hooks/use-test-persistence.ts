"use client";

import { persistTest } from "@/services/test-service";
import { useWizardStore } from "@/store/wizard-store";
import type { TestStatus } from "@/types";

interface PersistResult {
  id: string;
  status: TestStatus;
}

export function useTestPersistence() {
  const {
    testId,
    basicInfo,
    selectedQuestions,
    setPersistedTestId,
    markSaved,
  } = useWizardStore();

  async function persist(status: TestStatus): Promise<PersistResult> {
    if (!basicInfo.title.trim()) {
      throw new Error("Test title is required.");
    }

    if (!basicInfo.discipline) {
      throw new Error("Discipline is required.");
    }

    if (status === "Active" && selectedQuestions.length === 0) {
      throw new Error("Add at least one question before publishing.");
    }

    const saved = await persistTest({
      testId: testId ?? undefined,
      title: basicInfo.title,
      description: basicInfo.description,
      discipline: basicInfo.discipline,
      status,
      questionIds: selectedQuestions.map((question) => question.id),
    });

    setPersistedTestId(saved.id);
    markSaved();

    return { id: saved.id, status: saved.status };
  }

  return {
    saveDraft: () => persist("Draft"),
    publishTest: () => persist("Active"),
  };
}