/**
 * History + feedback client for the Academy Assistant (AI-L-1 slice A6).
 *
 * Plain JSON endpoints (platform `ApiResponse` envelope) next to the SSE stream:
 *   GET  /ai/assistant/conversations              — the caller's conversations
 *   GET  /ai/assistant/conversations/{threadId}   — transcript + live pending cards
 *   POST /ai/assistant/feedback                   — 👍/👎 on an assistant message
 *
 * Uses the same raw-fetch auth as assistant-stream.ts; a non-2xx becomes an
 * AssistantRequestError so callers can branch on status (403/404).
 */
import {
  AssistantRequestError,
  assistantApiBase,
  readAccessToken,
  type AssistantCitation,
  type AssistantConfirmRequest,
  type AssistantNavigation,
} from "./assistant-stream";

export interface AssistantConversationSummary {
  threadId: string;
  title: string | null;
  updatedAt: string | null;
}

export interface AssistantHistoryMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: AssistantCitation[] | null;
  navigations: AssistantNavigation[] | null;
  feedbackRating: "up" | "down" | null;
  createdAt: string | null;
}

export interface AssistantConversationDetail {
  threadId: string;
  title: string | null;
  messages: AssistantHistoryMessage[];
  /** Confirmation cards still paused server-side — restored so the learner can decide. */
  pending: AssistantConfirmRequest[];
  /** Text the assistant streamed before pausing on those cards (not yet a persisted row). */
  pendingAnswer: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readAccessToken();
  const response = await fetch(`${assistantApiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new AssistantRequestError(response.status);
  const envelope = (await response.json()) as { data: T };
  return envelope.data;
}

export function listConversations(): Promise<AssistantConversationSummary[]> {
  return request("/ai/assistant/conversations");
}

export function getConversation(
  threadId: string,
): Promise<AssistantConversationDetail> {
  return request(`/ai/assistant/conversations/${encodeURIComponent(threadId)}`);
}

export async function sendAssistantFeedback(
  messageId: number,
  rating: "up" | "down",
): Promise<void> {
  await request("/ai/assistant/feedback", {
    method: "POST",
    body: JSON.stringify({ messageId, rating }),
  });
}
