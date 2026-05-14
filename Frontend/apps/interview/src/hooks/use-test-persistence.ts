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
    config,
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
      maxAttempts: config.maxAttempts,
      allowSkipping: config.allowSkipping,
      allowBacktracking: config.allowBacktracking,
      showProgressBar: config.showProgressBar,
      randomizeOrder: config.randomizeOrder,
    });

    // Guard against any backend fallback to Draft when publishing.
    // If publish did not persist as Active, retry once as an explicit update.
    const ensured =
      status === "Active" && saved.status !== "Active"
        ? await persistTest({
            testId: saved.id,
            title: basicInfo.title,
            description: basicInfo.description,
            discipline: basicInfo.discipline,
            status: "Active",
            questionIds: selectedQuestions.map((question) => question.id),
            maxAttempts: config.maxAttempts,
            allowSkipping: config.allowSkipping,
            allowBacktracking: config.allowBacktracking,
            showProgressBar: config.showProgressBar,
            randomizeOrder: config.randomizeOrder,
          })
        : saved;

    if (status === "Active" && ensured.status !== "Active") {
 throw new Error(
        `Publish failed: test status remained ${ensured.status}. Please try again.`,
      );    }

    setPersistedTestId(ensured.id);
    markSaved();

    return { id: ensured.id, status: ensured.status };
  }

  return {
    saveDraft: () => persist("Draft"),
    publishTest: () => persist("Active"),
  };
}