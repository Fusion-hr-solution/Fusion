import type {
  FeedbackComment,
  FeedbackOverview,
  FeedbackOverviewFilters,
  FeedbackTrendPoint,
  TrainerFeedbackDetail,
  TrainerFeedbackListItem,
  TrainingFeedbackSummary,
} from "@/types/admin";
import type { TrainerGroupFeedback } from "@/types";
import type {
  BackendFeedbackCommentDto,
  BackendFeedbackOverviewDto,
  BackendFeedbackTrendPointDto,
  BackendTrainerFeedbackDetailDto,
  BackendTrainerFeedbackListItemDto,
  BackendTrainerGroupFeedbackDto,
  BackendTrainingFeedbackSummaryDto,
} from "@/types/backend-dtos";
import { client } from "./admin-service-mappers";

const BASE = "/training/admin/feedback";

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function mapTrend(dto: BackendFeedbackTrendPointDto): FeedbackTrendPoint {
  return {
    year: dto.year,
    month: dto.month,
    label: dto.label,
    avgOverallRating: dto.avgOverallRating,
    responseCount: dto.responseCount,
  };
}

function mapComment(dto: BackendFeedbackCommentDto): FeedbackComment {
  return {
    author: dto.author,
    comment: dto.comment,
    overallRating: dto.overallRating,
    submittedAt: dto.submittedAt,
    trainingTitle: dto.trainingTitle ?? undefined,
  };
}

export async function getTrainingFeedback(
  trainingId: string,
  from?: string,
  to?: string,
): Promise<TrainingFeedbackSummary> {
  const dto = await client.get<BackendTrainingFeedbackSummaryDto>(
    `${BASE}/training/${encodeURIComponent(trainingId)}${buildQuery({ from, to })}`,
  );
  return {
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    totalResponses: dto.totalResponses,
    avgOverallRating: dto.avgOverallRating,
    avgContentRating: dto.avgContentRating,
    avgRelevanceRating: dto.avgRelevanceRating,
    avgTrainerRating: dto.avgTrainerRating ?? undefined,
    recommendationRate: dto.recommendationRate,
    ratingDistribution: dto.ratingDistribution,
    monthlyTrend: dto.monthlyTrend.map(mapTrend),
    commentsSuppressed: dto.commentsSuppressed,
    comments: dto.comments.map(mapComment),
  };
}

export async function getTrainerFeedbackList(
  from?: string,
  to?: string,
): Promise<TrainerFeedbackListItem[]> {
  const dtos = await client.get<BackendTrainerFeedbackListItemDto[]>(
    `${BASE}/trainers${buildQuery({ from, to })}`,
  );
  return dtos.map((d) => ({
    trainerKey: d.trainerKey,
    trainerName: d.trainerName,
    sessionsCount: d.sessionsCount,
    feedbackCount: d.feedbackCount,
    avgTrainerRating: d.avgTrainerRating,
    recommendationRate: d.recommendationRate,
  }));
}

export async function getTrainerFeedbackDetail(
  trainerKey: string,
  from?: string,
  to?: string,
): Promise<TrainerFeedbackDetail> {
  const dto = await client.get<BackendTrainerFeedbackDetailDto>(
    `${BASE}/trainer${buildQuery({ key: trainerKey, from, to })}`,
  );
  return {
    trainerKey: dto.trainerKey,
    trainerName: dto.trainerName,
    sessionsCount: dto.sessionsCount,
    feedbackCount: dto.feedbackCount,
    avgTrainerRating: dto.avgTrainerRating,
    recommendationRate: dto.recommendationRate,
    trainings: dto.trainings.map((tr) => ({
      trainingId: tr.trainingId,
      trainingTitle: tr.trainingTitle,
      feedbackCount: tr.feedbackCount,
      avgTrainerRating: tr.avgTrainerRating,
    })),
    commentsSuppressed: dto.commentsSuppressed,
    comments: dto.comments.map(mapComment),
  };
}

export async function getFeedbackOverview(
  filters: FeedbackOverviewFilters = {},
): Promise<FeedbackOverview> {
  const dto = await client.get<BackendFeedbackOverviewDto>(
    `${BASE}/overview${buildQuery({
      categoryId: filters.categoryId,
      format: filters.format,
      from: filters.from,
      to: filters.to,
    })}`,
  );
  return {
    totalFeedbacks: dto.totalFeedbacks,
    avgOverallRating: dto.avgOverallRating,
    recommendationRate: dto.recommendationRate,
    responseRate: dto.responseRate,
    ratingDistribution: dto.ratingDistribution,
    monthlyTrend: dto.monthlyTrend.map(mapTrend),
    topTrainings: dto.topTrainings,
    bottomTrainings: dto.bottomTrainings,
  };
}

/** The trainer's group feedback for a session (US-8.1.3); null if none submitted. */
export async function getSessionTrainerFeedback(sessionId: string): Promise<TrainerGroupFeedback | null> {
  const dto = await client.get<BackendTrainerGroupFeedbackDto | null>(
    `${BASE}/trainer-group/${encodeURIComponent(sessionId)}`,
  );
  if (!dto) return null;
  return {
    sessionId: dto.sessionId,
    trainerEmployeeId: dto.trainerEmployeeId,
    trainerName: dto.trainerName,
    groupEngagement: dto.groupEngagement,
    knowledgeLevel: dto.knowledgeLevel,
    comments: dto.comments ?? undefined,
    prerequisiteSuggestions: dto.prerequisiteSuggestions ?? undefined,
    submittedAt: dto.submittedAt,
  };
}
