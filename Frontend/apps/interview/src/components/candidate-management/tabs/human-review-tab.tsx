"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPendingReviews, approveReview } from "@/services/grading-service";
import type { ReviewQueueItem } from "@/types";

export function HumanReviewTab() {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<string | null>(null);
  const [overrideScores, setOverrideScores] = useState<Record<string, string>>({});
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["review-queue"],
    queryFn: getPendingReviews,
    refetchInterval: 30_000,
  });

  function getScore(item: ReviewQueueItem): number {
    const raw = overrideScores[item.resultId];
    if (raw !== undefined) {
      const parsed = parseFloat(raw);
      return Number.isNaN(parsed) ? item.aiSuggestedScore : parsed;
    }
    return item.aiSuggestedScore;
  }

  async function handleApprove(item: ReviewQueueItem): Promise<void> {
    setApproving(item.resultId);
    setApproveError(null);
    setApproveSuccess(null);

    const score = getScore(item);

    try {
      await approveReview(item.resultId, score);
      setApproveSuccess(`Approved: ${item.candidateName} — ${item.questionTitle}`);
      setOverrideScores((prev) => {
        const next = { ...prev };
        delete next[item.resultId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "Failed to approve review.");
    } finally {
      setApproving(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-zinc-400 text-[13px]">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading review queue...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-6 text-red-500 text-[13px]">
        <AlertCircle className="h-4 w-4" />
        Failed to load review queue.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900">Human Review Queue</h3>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            AI-graded responses that need manual verification. Refreshes every 30 seconds.
          </p>
        </div>
        {items.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <ClipboardCheck className="h-3 w-3" />
            {items.length} pending
          </span>
        )}
      </div>

      {approveSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {approveSuccess}
        </div>
      )}

      {approveError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {approveError}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
          <p className="text-[13px] font-medium text-zinc-700">All caught up!</p>
          <p className="text-[12px] text-zinc-400 mt-0.5">No responses are waiting for human review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReviewCard
              key={item.resultId}
              item={item}
              scoreInput={overrideScores[item.resultId] ?? String(item.aiSuggestedScore)}
              onScoreChange={(v) =>
                setOverrideScores((prev) => ({ ...prev, [item.resultId]: v }))
              }
              onApprove={() => handleApprove(item)}
              isApproving={approving === item.resultId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewCardProps {
  item: ReviewQueueItem;
  scoreInput: string;
  onScoreChange: (v: string) => void;
  onApprove: () => void;
  isApproving: boolean;
}

function ReviewCard({ item, scoreInput, onScoreChange, onApprove, isApproving }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900 truncate">{item.questionTitle}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{item.candidateName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] font-medium text-zinc-600">
            AI: {item.aiSuggestedScore} / {item.maxScore} pts
          </span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
            expanded ? "bg-zinc-200 text-zinc-600" : "bg-zinc-100 text-zinc-500"
          )}>
            {expanded ? "Collapse" : "Review"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-4 space-y-4">
          <div>
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Question</p>
            <p className="text-[13px] text-zinc-700 whitespace-pre-wrap">{item.questionText}</p>
          </div>

          <div>
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Candidate's Answer</p>
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-[12px] text-zinc-800 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
              {item.candidateAnswer || <span className="text-zinc-400 italic">No answer provided</span>}
            </div>
          </div>

          {item.aiSuggestedFeedback && (
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">AI Feedback</p>
              <p className="text-[13px] text-zinc-600 italic">{item.aiSuggestedFeedback}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-medium text-zinc-600 whitespace-nowrap">
                Override score
              </label>
              <input
                type="number"
                min={0}
                max={item.maxScore}
                step={0.5}
                value={scoreInput}
                onChange={(e) => onScoreChange(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              <span className="text-[12px] text-zinc-400">/ {item.maxScore}</span>
            </div>

            <button
              type="button"
              onClick={onApprove}
              disabled={isApproving}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                isApproving
                  ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                  : "bg-zinc-900 text-white hover:bg-zinc-700"
              )}
            >
              {isApproving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isApproving ? "Approving..." : "Approve"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
