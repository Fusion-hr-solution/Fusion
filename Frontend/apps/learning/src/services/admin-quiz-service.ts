import type {
  QuizDraft,
  QuizDraftQuestionInput,
  QuizPublishResult,
} from "@/types/admin";
import type {
  BackendQuizDraftDto,
  BackendQuizPublishResultDto,
} from "@/types/backend-dtos";
import { client, mapQuizDraft } from "./admin-service-mappers";

function base(trainingId: string): string {
  return `/training/admin/trainings/${encodeURIComponent(trainingId)}/quiz`;
}

/** Read the training's current quiz draft (and whether AI generation is configured). */
export async function getQuizDraft(trainingId: string): Promise<QuizDraft> {
  const data = await client.get<BackendQuizDraftDto>(`${base(trainingId)}/draft`);
  return mapQuizDraft(data);
}

/** Generate quiz questions from the training's content into its draft. */
export async function generateQuiz(trainingId: string, count: number): Promise<QuizDraft> {
  const data = await client.post<BackendQuizDraftDto>(
    `${base(trainingId)}/generate?count=${encodeURIComponent(count)}`,
    {},
  );
  return mapQuizDraft(data);
}

/** Persist the reviewed/edited draft. */
export async function saveQuizDraft(
  trainingId: string,
  questions: QuizDraftQuestionInput[],
): Promise<QuizDraft> {
  const data = await client.put<BackendQuizDraftDto>(`${base(trainingId)}/draft`, { questions });
  return mapQuizDraft(data);
}

/** Discard the training's quiz draft. */
export async function discardQuizDraft(trainingId: string): Promise<void> {
  await client.delete(`${base(trainingId)}/draft`);
}

/** Publish the reviewed questions into the training's exam and clear the draft. */
export async function publishQuiz(
  trainingId: string,
  questions: QuizDraftQuestionInput[],
): Promise<QuizPublishResult> {
  return client.post<BackendQuizPublishResultDto>(`${base(trainingId)}/publish`, { questions });
}
