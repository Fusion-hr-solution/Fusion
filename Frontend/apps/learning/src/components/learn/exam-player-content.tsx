import { Loader2, AlertCircle } from "lucide-react";
import type { useExamPlayer } from "@/hooks/use-exam-player";
import { ExamTakingView } from "./exam-taking-view";

export function ExamPlayerContent({
  examPlayer,
  onBack,
}: {
  examPlayer: ReturnType<typeof useExamPlayer>;
  onBack: () => void;
}) {
  if (examPlayer.phase === "loading" || examPlayer.isLoadingExam) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (examPlayer.examError || !examPlayer.exam) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Failed to load exam. You may need to complete all chapters first.</p>
          <button onClick={onBack} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors">Back to chapters</button>
        </div>
      </div>
    );
  }

  return (
    <ExamTakingView
      exam={examPlayer.exam}
      attempts={examPlayer.attempts}
      phase={examPlayer.phase}
      result={examPlayer.result}
      answers={examPlayer.answers}
      onSetAnswer={examPlayer.setAnswer}
      onStart={examPlayer.startExam}
      onSubmit={examPlayer.handleSubmit}
      onRetry={examPlayer.retryExam}
      onBack={onBack}
      isSubmitting={examPlayer.isSubmitting}
    />
  );
}
