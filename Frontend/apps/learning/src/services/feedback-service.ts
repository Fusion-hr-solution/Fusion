import { createPlatformApiClient } from "@repo/api";
import type { PendingFeedback, SubmitFeedbackInput, TrainingType } from "@/types";
import type {
  BackendPendingFeedbackDto,
  BackendSubmitFeedbackRequest,
} from "@/types/backend-dtos";

const client = createPlatformApiClient();

function mapPendingFeedback(dto: BackendPendingFeedbackDto): PendingFeedback {
  return {
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    trainingType: (dto.trainingType as TrainingType) ?? "ELearning",
    completedAt: dto.completedAt,
  };
}

/** Completed trainings the current learner has not yet given feedback for. */
export async function getMyPendingFeedback(): Promise<PendingFeedback[]> {
  const dtos = await client.get<BackendPendingFeedbackDto[]>("/training/feedback/pending/me");
  return dtos.map(mapPendingFeedback);
}

/** Submit feedback for a completed training. Returns the new feedback id. */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<string> {
  const body: BackendSubmitFeedbackRequest = {
    trainingId: input.trainingId,
    overallRating: input.overallRating,
    contentRating: input.contentRating,
    relevanceRating: input.relevanceRating,
    trainerRating: input.trainerRating, // undefined for e-learning — omitted from the payload
    wouldRecommend: input.wouldRecommend,
    comment: input.comment,
    suggestions: input.suggestions,
    isAnonymous: input.isAnonymous,
  };
  return client.post<string>("/training/feedback", body);
}
