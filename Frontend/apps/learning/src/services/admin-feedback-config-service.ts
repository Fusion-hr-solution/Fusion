import type { FeedbackQuestion, FeedbackQuestionType } from "@/types";
import type { CreateFeedbackQuestionInput, UpdateFeedbackQuestionInput } from "@/types/admin";
import type { BackendFeedbackQuestionDto } from "@/types/backend-dtos";
import { client } from "./admin-service-mappers";

const BASE = "/training/admin/feedback/questions";

function mapQuestion(d: BackendFeedbackQuestionDto): FeedbackQuestion {
  return {
    id: d.id,
    categoryId: d.categoryId ?? undefined,
    type: d.type as FeedbackQuestionType,
    label: d.label,
    order: d.order,
    options: d.options ?? undefined,
  };
}

/** Active custom questions for a category (omit categoryId for the default form). */
export async function getFeedbackQuestions(categoryId?: string): Promise<FeedbackQuestion[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  const dtos = await client.get<BackendFeedbackQuestionDto[]>(`${BASE}${qs}`);
  return dtos.map(mapQuestion);
}

export async function createFeedbackQuestion(input: CreateFeedbackQuestionInput): Promise<string> {
  return client.post<string>(BASE, {
    categoryId: input.categoryId,
    type: input.type,
    label: input.label,
    options: input.options,
  });
}

export async function updateFeedbackQuestion(id: string, input: UpdateFeedbackQuestionInput): Promise<void> {
  await client.put(`${BASE}/${encodeURIComponent(id)}`, input);
}

export async function retireFeedbackQuestion(id: string): Promise<void> {
  await client.delete(`${BASE}/${encodeURIComponent(id)}`);
}

export async function reorderFeedbackQuestions(questionIds: string[]): Promise<void> {
  await client.post(`${BASE}/reorder`, { questionIds });
}
