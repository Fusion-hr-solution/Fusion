"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreateQuestionSheet } from "@/components/create-test-page/create-question-sheet";
import { createQuestion } from "@/services/test-service";
import { useWizardStore } from "@/store/wizard-store";
import type { NewQuestionForm } from "@/types";

export default function CreateQuestionPage() {
  const router = useRouter();
  const { addQuestion, isQuestionSelected } = useWizardStore();

  async function saveQuestion(form: NewQuestionForm, addToSelection: boolean): Promise<void> {
    const created = await createQuestion(form);

    if (addToSelection && !isQuestionSelected(created.id)) {
      addQuestion(created);
    }

    router.push("/tests/create");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50/40">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8">
          <div className="mb-5 flex w-full items-center justify-between">
        <button
          onClick={() => router.push("/tests/create")}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Test Builder
        </button>
          </div>

          <CreateQuestionSheet
            fullPage
            onClose={() => router.push("/tests/create")}
            onSaveToLibrary={(form) => saveQuestion(form, false)}
            onSaveAndAdd={(form) => saveQuestion(form, true)}
          />
        </div>
      </div>
    </div>
  );
}
