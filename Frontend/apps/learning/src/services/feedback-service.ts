import { createPlatformApiClient } from "@repo/api";
import type {
  FeedbackQuestion,
  FeedbackQuestionType,
  PendingFeedback,
  SubmitFeedbackInput,
  SubmitTrainerGroupFeedbackInput,
  TrainerSession,
  TrainingType,
} from "@/types";
import type {
  BackendFeedbackQuestionDto,
  BackendPendingFeedbackDto,
  BackendSubmitFeedbackRequest,
  BackendTrainerSessionDto,
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

/** The active custom questions to render on a training's feedback form (US-8.1.3). */
export async function getTrainingFeedbackQuestions(trainingId: string): Promise<FeedbackQuestion[]> {
  const dtos = await client.get<BackendFeedbackQuestionDto[]>(
    `/training/feedback/${encodeURIComponent(trainingId)}/questions`,
  );
  return dtos.map((d) => ({
    id: d.id,
    categoryId: d.categoryId ?? undefined,
    type: d.type as FeedbackQuestionType,
    label: d.label,
    order: d.order,
    options: d.options ?? undefined,
  }));
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
    answers: input.answers ?? [],
  };
  return client.post<string>("/training/feedback", body);
}

/** Sessions the current user leads as trainer (US-8.1.3). */
export async function getMyTrainerSessions(): Promise<TrainerSession[]> {
  const dtos = await client.get<BackendTrainerSessionDto[]>("/training/feedback/trainer-sessions/me");
  return dtos.map((d) => ({
    sessionId: d.sessionId,
    trainingTitle: d.trainingTitle,
    partTitle: d.partTitle,
    startUtc: d.startUtc,
    endUtc: d.endUtc,
    room: d.room,
    status: d.status,
    hasGroupFeedback: d.hasGroupFeedback,
  }));
}

/** Submit a trainer's group feedback for a session they led. Returns the new feedback id. */
export async function submitTrainerGroupFeedback(
  input: SubmitTrainerGroupFeedbackInput,
): Promise<string> {
  return client.post<string>("/training/feedback/trainer-group", {
    sessionId: input.sessionId,
    groupEngagement: input.groupEngagement,
    knowledgeLevel: input.knowledgeLevel,
    comments: input.comments,
    prerequisiteSuggestions: input.prerequisiteSuggestions,
  });
}
