/**
 * SSE client for the Academy Assistant (`POST /api/ai/assistant`, AI-L-1 / ADR-0013).
 *
 * The shared `@repo/api` client can't stream, so this uses a raw `fetch` + `ReadableStream`
 * reader, attaching the Bearer token from the `ey_hr_auth` localStorage entry (kept fresh by
 * the platform client's silent refresh on every ordinary API call).
 *
 * Server events: meta {threadId} · token {text} · tool_start {name,label} · tool_end
 * {name,ok} · citations {citations[]} · confirm_request {interruptId,tool,…} ·
 * done {threadId,awaitingConfirmation} · error {message}.
 *
 * Confirmation flow (slice A5): a write tool pauses server-side and the stream ends with
 * `confirm_request` + `done {awaitingConfirmation:true}`. The turn is continued by a new
 * call carrying `resume` (and the SAME threadId) instead of `message`; the server replies
 * 409 when that confirmation no longer exists (e.g. the ai-service restarted).
 */

export interface AssistantCitation {
  trainingId: string;
  chapterId: string;
  contentBlockId: string;
  blockTitle: string | null;
  /** Set when the answer drew on enrolled courses beyond the open chapter (slice A3). */
  courseTitle?: string | null;
  snippet: string;
}

/** Typed route directive (L1-10): the server names a destination, never a URL;
 * the client owns the mapping to real routes. */
export interface AssistantNavigation {
  destination: string;
  mode: "auto" | "suggest";
  label?: string;
}

/** A write tool paused for the learner's decision (slice A5). The card renders from
 * these server-provided facts (fetched from Training, never model-written). */
export interface AssistantConfirmRequest {
  interruptId: string;
  tool: "enrol_elearning" | "mark_complete" | (string & {});
  trainingId?: string;
  title?: string;
  credits?: number | null;
  chapterId?: string;
  chapterTitle?: string;
  trainingTitle?: string;
  blocksRemaining?: number;
  blocksTotal?: number;
}

export type AssistantEvent =
  | { event: "meta"; data: { threadId: string } }
  | { event: "token"; data: { text: string } }
  | { event: "tool_start"; data: { name: string; label?: string } }
  | { event: "tool_end"; data: { name: string; ok: boolean } }
  | { event: "citations"; data: { citations: AssistantCitation[] } }
  | { event: "navigate"; data: AssistantNavigation }
  | { event: "confirm_request"; data: AssistantConfirmRequest }
  | {
      event: "done";
      data: {
        threadId: string;
        awaitingConfirmation?: boolean;
        /** Persisted assistant-message id to rate with 👍/👎 (slice A6); null while a
         * confirmation is still pending (the turn isn't finished yet). */
        messageId?: number | null;
      };
    }
  | { event: "error"; data: { message: string } };

export class AssistantRequestError extends Error {
  constructor(public readonly status: number) {
    super(`assistant request failed (${status})`);
    this.name = "AssistantRequestError";
  }
}

export interface StreamAssistantOptions {
  /** The learner's message — omitted when resuming a paused confirmation. */
  message?: string;
  threadId?: string | null;
  context?: { trainingId: string; chapterId: string };
  /** Continue a turn paused on a confirmation card (requires threadId). */
  resume?: { interruptId: string; approved: boolean };
  signal?: AbortSignal;
  onEvent: (event: AssistantEvent) => void;
}

// Same resolution as createPlatformApiClient: env override for direct-to-gateway, else the
// relative /api that the dev-server rewrites to the gateway.
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

/** Trailing-slash-free API base — shared with the history/feedback client (slice A6). */
export function assistantApiBase(): string {
  return BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
}

export function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ey_hr_auth");
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken?: string }).accessToken ?? null;
  } catch {
    return null;
  }
}

/** Open the stream and dispatch each SSE event; resolves when the server closes it. */
export async function streamAssistant(options: StreamAssistantOptions): Promise<void> {
  const token = readAccessToken();
  const base = assistantApiBase();

  const response = await fetch(`${base}/ai/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: options.message,
      threadId: options.threadId ?? undefined,
      context: options.context,
      resume: options.resume,
    }),
    signal: options.signal,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    throw new AssistantRequestError(response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName: string | null = null;

  // Frames are "event: <name>\ndata: <one-line json>\n\n"; chunks can split anywhere.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);

      if (line.startsWith("event: ")) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith("data: ") && eventName) {
        try {
          options.onEvent({
            event: eventName,
            data: JSON.parse(line.slice(6)),
          } as AssistantEvent);
        } catch {
          // Malformed frame — skip rather than kill the stream.
        }
        eventName = null;
      }
      // Blank lines are frame separators; nothing to do.
    }
  }
}
