import { ApiError } from "@repo/api";
import type {
  AdminExamDetail,
  CreateExamInput,
  UpdateExamInput,
  CreateExamQuestionInput,
  UpdateExamQuestionInput,
} from "@/types/admin";
import type { BackendAdminExamDetailDto } from "@/types/backend-dtos";
import { client, mapExamDetail } from "./admin-service-mappers";

export async function getAdminExamDetail(trainingId: string): Promise<AdminExamDetail | null> {
  try {
    const data = await client.get<BackendAdminExamDetailDto>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam`);
    return mapExamDetail(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createExam(trainingId: string, input: CreateExamInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam`, input);
}

export async function updateExam(trainingId: string, examId: string, input: UpdateExamInput): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}`, input);
}

export async function deleteExam(trainingId: string, examId: string): Promise<void> {
  await client.delete(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}`);
}

export async function addExamQuestion(trainingId: string, examId: string, input: CreateExamQuestionInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions`, input);
}

export async function updateExamQuestion(trainingId: string, examId: string, questionId: string, input: UpdateExamQuestionInput): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}`, input);
}

export async function deleteExamQuestion(trainingId: string, examId: string, questionId: string): Promise<void> {
  await client.delete(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}`);
}

export async function reorderExamQuestions(trainingId: string, examId: string, questionIds: string[]): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions/reorder`, { questionIds });
}
