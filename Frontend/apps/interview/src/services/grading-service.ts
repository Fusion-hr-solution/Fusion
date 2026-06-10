import { createPlatformApiClient } from "@repo/api";
import type { ReviewQueueItem } from "@/types";

const client = createPlatformApiClient();

interface BackendReviewQueueItemDto {
  resultId: string;
  attemptId: string;
  candidateName: string;
  questionTitle: string;
  questionText: string;
  candidateAnswer: string;
  aiSuggestedFeedback?: string;
  aiSuggestedScore: number;
  maxScore: number;
}

function mapReviewItem(dto: BackendReviewQueueItemDto): ReviewQueueItem {
  return {
    resultId: dto.resultId,
    attemptId: dto.attemptId,
    candidateName: dto.candidateName,
    questionTitle: dto.questionTitle,
    questionText: dto.questionText,
    candidateAnswer: dto.candidateAnswer,
    aiSuggestedFeedback: dto.aiSuggestedFeedback,
    aiSuggestedScore: dto.aiSuggestedScore,
    maxScore: dto.maxScore,
  };
}

export async function getPendingReviews(): Promise<ReviewQueueItem[]> {
  const items = await client.get<BackendReviewQueueItemDto[]>(
    "/interview/grading/review"
  );
  return (items ?? []).map(mapReviewItem);
}

export async function approveReview(
  resultId: string,
  score: number,
  reviewerEmail: string
): Promise<void> {
  await client.post(`/interview/grading/review/${resultId}/approve`, {
    score,
    reviewerEmail,
  });
}
