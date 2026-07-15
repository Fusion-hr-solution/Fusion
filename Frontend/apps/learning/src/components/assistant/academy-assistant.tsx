"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  X,
  FileText,
  MessageCircle,
  Maximize2,
  Minimize2,
  ArrowRight,
  Check,
  History,
  SquarePen,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button, cn } from "@repo/ui";

import { renderMarkdown } from "@/components/learn/chapter-content-utils";
import { useAssistantScope } from "./assistant-scope";
import {
  AssistantRequestError,
  streamAssistant,
  type AssistantCitation,
  type AssistantConfirmRequest,
  type AssistantEvent,
  type AssistantNavigation,
} from "@/services/assistant-stream";
import {
  getConversation,
  listConversations,
  sendAssistantFeedback,
  type AssistantConversationDetail,
  type AssistantConversationSummary,
} from "@/services/assistant-history";

type TurnStatus = "waiting" | "tool" | "streaming" | "confirm" | "done" | "error";

/** A confirmation card's lifecycle. "pending" is the ONLY state whose buttons can act;
 * every other state is final — a card can never fire its write twice (or at all,
 * without an explicit click). */
type ConfirmDecision = "pending" | "approved" | "declined" | "expired";

interface TurnConfirmation extends AssistantConfirmRequest {
  decision: ConfirmDecision;
}

interface Turn {
  id: number;
  question: string;
  answer: string; // grows while streaming
  status: TurnStatus;
  toolLabel: string | null; // shown while status === "tool"
  citations: AssistantCitation[];
  navigations: AssistantNavigation[];
  confirmations: TurnConfirmation[];
  /** Persisted assistant-message id (slice A6) — ratable with 👍/👎 once set. */
  messageId: number | null;
  feedback: "up" | "down" | null;
  feedbackBusy?: boolean; // rating request in flight (thumbs held)
  feedbackError?: boolean; // last rating attempt failed
}

/** Typed destination → app route (L1-10). The server never sends URLs; unknown
 * destinations are ignored — this map is the last line of defense, so it must stay
 * inert even for a divergent server payload (Map = no prototype-chain lookups).
 * basePath (/learning) is applied by the Next router. */
const FIXED_DESTINATIONS = new Map<string, string>([
  ["catalog", "/"],
  ["dashboard", "/dashboard"],
  ["cursus", "/cursus"],
  ["my-trainings", "/my-trainings"],
  ["my-sessions", "/my-sessions"],
  ["certificates", "/certificates"],
]);
const GUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ID_DESTINATION = new RegExp(`^(training|learn):(${GUID})$`, "i");

function destinationPath(destination: string): string | null {
  const fixedPath = FIXED_DESTINATIONS.get(destination);
  if (fixedPath) return fixedPath;
  const m = ID_DESTINATION.exec(destination);
  if (!m) return null;
  return m[1] === "learn" ? `/training/${m[2]}/learn` : `/training/${m[2]}`;
}

/** i18n key (under learn.ask.dest) naming a destination, for button text fallback. */
function destinationKey(destination: string): string {
  if (destination.startsWith("learn:")) return "learn";
  if (destination.startsWith("training:")) return "training";
  return destination.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Docked bottom-right vs. expanded-and-centered. Both anchor via right/bottom so the four
// numeric properties (right, bottom, width, height) interpolate for a smooth corner→center move.
const PANEL_DOCKED: CSSProperties = {
  width: "380px",
  maxWidth: "calc(100vw - 3rem)",
  height: "min(70vh, 560px)",
  right: "1.5rem",
  bottom: "1.5rem",
};
const PANEL_EXPANDED: CSSProperties = {
  width: "min(760px, 92vw)",
  height: "min(85vh, 920px)",
  right: "calc((100vw - min(760px, 92vw)) / 2)",
  bottom: "calc((100vh - min(85vh, 920px)) / 2)",
};

/** Smooth-scroll to a content block and briefly highlight it (course player only). */
function scrollToBlock(contentBlockId: string) {
  const el = document.getElementById(`content-block-${contentBlockId}`);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  el.classList.add("ring-2", "ring-[hsl(var(--ey-blue-500))]");
  window.setTimeout(
    () => el.classList.remove("ring-2", "ring-[hsl(var(--ey-blue-500))]"),
    1600,
  );
}

function ThinkingDots({ label }: { label: string }) {
  return (
    <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-muted/40 px-3 py-3">
      <span className="sr-only">{label}</span>
      <span className="ey-typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      <span
        className="ey-typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="ey-typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground"
        style={{ animationDelay: "0.3s" }}
      />
    </div>
  );
}

/**
 * The EY Academy Assistant (AI-L-1, ADR-0013) — one context-aware assistant for the whole
 * Learning module, mounted in the app's root layout. Inside a chapter it auto-scopes to that
 * chapter (the AI-L-2 behavior); elsewhere it answers module-wide (agent tools arrive in A3+).
 * Streams the agent's SSE events: tool status while it works, tokens as it answers, citation
 * chips that jump to the source block. One conversation thread per session.
 */
export function AcademyAssistant() {
  const t = useTranslations("learn");
  const locale = useLocale();
  const scope = useAssistantScope();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("ready");
  const [openingThread, setOpeningThread] = useState<string | null>(null); // detail fetch in flight
  const [detailError, setDetailError] = useState(false); // opening a conversation failed

  const nextId = useRef(1);
  const threadId = useRef<string | null>(null); // one conversation per session
  const resolvedConfirmations = useRef(new Set<string>()); // ids already decided
  const turnAutoNav = useRef(new Set<number>()); // turns that already auto-navigated
  // Bumped by anything that changes which conversation the panel is on (open, new chat,
  // back-to-chat, submit) — an openConversation response from a previous epoch is stale
  // and must be discarded, or it would yank the user (and orphan a live stream).
  const openEpoch = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  // A pending confirmation also blocks the composer: the server thread is paused on it,
  // so a new message can't be processed until the learner decides (or the card expires).
  const busy = turns.some(
    (x) =>
      x.status === "waiting" ||
      x.status === "tool" ||
      x.status === "streaming" ||
      x.status === "confirm" ||
      x.confirmations.some((c) => c.decision === "pending"),
  );
  // An ACTIVE stream is stricter than `busy`: it is still writing into `turns`, so
  // switching or clearing the conversation under it would orphan its events. A pending
  // card alone does NOT lock navigation — the pause survives server-side and the card
  // comes back (from the server) when the conversation is reopened.
  const streamBusy = turns.some(
    (x) => x.status === "waiting" || x.status === "tool" || x.status === "streaming",
  );

  // Abort an in-flight stream if the assistant unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Collapsing (or closing) drops any drag offset so it re-centers cleanly.
  useEffect(() => {
    if (!expanded) setDrag({ x: 0, y: 0 });
  }, [expanded]);

  // Toggle `inert` on the hidden layer (removes phantom tab stops + a11y-tree exposure),
  // move focus into the panel on open, and return it to the launcher on close.
  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !open;
    if (launcherRef.current) launcherRef.current.inert = open;
    if (open) {
      inputRef.current?.focus();
      wasOpen.current = true;
    } else if (wasOpen.current) {
      launcherRef.current?.focus();
    }
    if (!open) setExpanded(false); // reopen docked
  }, [open]);

  // Keep the newest content in view (fires per streamed chunk too).
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [turns, open]);

  const TOOL_LABEL_KEYS: Record<string, string> = {
    search_course_content: "ask.toolSearch",
    get_my_trainings: "ask.toolTrainings",
    get_due_and_overdue: "ask.toolDue",
    get_my_cursus: "ask.toolCursus",
    search_catalog: "ask.toolCatalog",
    get_my_certificates: "ask.toolCertificates",
    get_my_sessions: "ask.toolSessions",
    navigate: "ask.toolNavigate",
    enrol_elearning: "ask.toolEnrol",
    mark_complete: "ask.toolComplete",
  };
  const toolLabel = (name: string, serverLabel?: string): string => {
    const key = TOOL_LABEL_KEYS[name];
    return key ? t(key) : (serverLabel ?? name);
  };

  const patchTurn = (id: number, partial: Partial<Turn>) =>
    setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, ...partial } : x)));

  /** Stream closed without done/error (e.g. proxy cut) — settle honestly. A turn with a
   * live (pending) confirmation card parks as "confirm": the pause survives server-side,
   * so the card IS the way forward — an error message demanding a retry would lie. */
  const settleTurn = (id: number) =>
    setTurns((prev) =>
      prev.map((x) => {
        if (x.id !== id || x.status === "done" || x.status === "error" || x.status === "confirm")
          return x;
        if (x.confirmations.some((c) => c.decision === "pending"))
          return { ...x, status: "confirm" };
        return x.answer
          ? { ...x, status: "done" }
          : { ...x, status: "error", answer: t("ask.error") };
      }),
    );

  /** A RESUME stream that dies before the server's done frame is different: the write
   * may or may not have fired — never fake success; say the outcome is unknown. */
  const settleResumedTurn = (id: number) =>
    setTurns((prev) =>
      prev.map((x) => {
        if (x.id !== id || x.status === "done" || x.status === "error" || x.status === "confirm")
          return x;
        if (x.confirmations.some((c) => c.decision === "pending"))
          return { ...x, status: "confirm" };
        return {
          ...x,
          status: "error",
          answer: x.answer ? `${x.answer}\n\n${t("ask.resumeCut")}` : t("ask.resumeCut"),
        };
      }),
    );

  /** One handler for both the initial stream and confirmation-resume streams — events
   * always land on the turn they belong to. */
  const makeEventHandler = (id: number) => {
    return (ev: AssistantEvent) => {
      switch (ev.event) {
        case "meta":
          threadId.current = ev.data.threadId;
          break;
        case "tool_start":
          patchTurn(id, { status: "tool", toolLabel: toolLabel(ev.data.name, ev.data.label) });
          break;
        case "token":
          setTurns((prev) =>
            prev.map((x) =>
              x.id === id
                ? { ...x, status: "streaming", answer: x.answer + ev.data.text }
                : x,
            ),
          );
          break;
        case "citations":
          setTurns((prev) =>
            prev.map((x) =>
              x.id === id
                ? { ...x, citations: [...x.citations, ...ev.data.citations] }
                : x,
            ),
          );
          break;
        case "navigate": {
          const nav = ev.data;
          const path = destinationPath(nav.destination);
          if (!path) break; // unknown destination — ignore, never guess a route
          // At most one auto-navigation per TURN — tracked per turn id, because a
          // confirmation resume opens a second stream (and handler) on the same turn.
          const effective: AssistantNavigation =
            nav.mode === "auto" && !turnAutoNav.current.has(id)
              ? nav
              : { ...nav, mode: "suggest" };
          if (effective.mode === "auto") {
            turnAutoNav.current.add(id);
            router.push(path);
          }
          setTurns((prev) =>
            prev.map((x) =>
              x.id === id
                ? { ...x, navigations: [...x.navigations, effective] }
                : x,
            ),
          );
          break;
        }
        case "confirm_request":
          // A re-pause after a partial resume re-emits the same id — dedupe so the
          // card (and its decision) survives across resume streams.
          setTurns((prev) =>
            prev.map((x) =>
              x.id === id &&
              !x.confirmations.some((c) => c.interruptId === ev.data.interruptId)
                ? {
                    ...x,
                    confirmations: [
                      ...x.confirmations,
                      { ...ev.data, decision: "pending" },
                    ],
                  }
                : x,
            ),
          );
          break;
        case "done":
          // The server is authoritative about what still awaits a decision: when it
          // says nothing does, any card still "pending" here no longer exists server-
          // side (its pause was consumed) — expire it honestly instead of leaving a
          // dead card that would lock the composer and 409 when clicked.
          setTurns((prev) =>
            prev.map((x) => {
              if (x.id !== id) return x;
              if (ev.data.awaitingConfirmation) return { ...x, status: "confirm" };
              return {
                ...x,
                status: "done",
                messageId: ev.data.messageId ?? x.messageId,
                confirmations: x.confirmations.map((c) =>
                  c.decision === "pending" ? { ...c, decision: "expired" } : c,
                ),
              };
            }),
          );
          break;
        case "error":
          patchTurn(id, { status: "error", answer: t("ask.error") });
          break;
      }
    };
  };

  const submit = async () => {
    const q = question.trim();
    if (!q || busy) return;
    openEpoch.current++; // a late openConversation response must not replace this turn
    setQuestion("");
    const id = nextId.current++;
    setTurns((prev) => [
      ...prev,
      {
        id,
        question: q,
        answer: "",
        status: "waiting",
        toolLabel: null,
        citations: [],
        navigations: [],
        confirmations: [],
        messageId: null,
        feedback: null,
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamAssistant({
        message: q,
        threadId: threadId.current,
        context: scope ?? undefined,
        signal: controller.signal,
        onEvent: makeEventHandler(id),
      });
      settleTurn(id);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patchTurn(id, { status: "error", answer: t("ask.error") });
      }
    } finally {
      abortRef.current = null;
    }
  };

  /** Approve/decline a confirmation card: lock the card, then resume the paused server
   * turn with the decision — a follow-up request on the same thread (no message). */
  const resolveConfirmation = async (
    turnId: number,
    interruptId: string,
    approved: boolean,
    tool: string,
  ) => {
    const thread = threadId.current;
    if (!thread || resolvedConfirmations.current.has(interruptId)) return;
    resolvedConfirmations.current.add(interruptId); // double-click / race guard
    setTurns((prev) =>
      prev.map((x) =>
        x.id === turnId
          ? {
              ...x,
              // "tool"/label keeps the bubble (and the locked card) visible while the
              // write executes and the reply streams — "waiting" would hide them.
              status: "tool",
              toolLabel: approved
                ? t(tool === "enrol_elearning" ? "ask.toolEnrol" : "ask.toolComplete")
                : t("ask.asking"),
              confirmations: x.confirmations.map((c) =>
                c.interruptId === interruptId
                  ? { ...c, decision: approved ? "approved" : "declined" }
                  : c,
              ),
            }
          : x,
      ),
    );

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamAssistant({
        threadId: thread,
        resume: { interruptId, approved },
        signal: controller.signal,
        onEvent: makeEventHandler(turnId),
      });
      settleResumedTurn(turnId);
    } catch (err) {
      if (err instanceof AssistantRequestError && err.status === 409) {
        // The pause no longer exists server-side (e.g. ai-service restarted, L1-6):
        // nothing was written — the card's "expired" note says so, honestly.
        setTurns((prev) =>
          prev.map((x) =>
            x.id === turnId
              ? {
                  ...x,
                  status: "done",
                  confirmations: x.confirmations.map((c) =>
                    c.interruptId === interruptId ? { ...c, decision: "expired" } : c,
                  ),
                }
              : x,
          ),
        );
      } else if ((err as Error).name !== "AbortError") {
        // The decision never reached the server (401/5xx/network) — the pause is still
        // live there. Roll the card back to pending so it can be retried; a locked
        // "Confirmed" card here would falsely claim the write happened.
        resolvedConfirmations.current.delete(interruptId);
        setTurns((prev) =>
          prev.map((x) =>
            x.id === turnId
              ? {
                  ...x,
                  status: "error",
                  answer: x.answer ? `${x.answer}\n\n${t("ask.error")}` : t("ask.error"),
                  confirmations: x.confirmations.map((c) =>
                    c.interruptId === interruptId ? { ...c, decision: "pending" } : c,
                  ),
                }
              : x,
          ),
        );
      }
    } finally {
      abortRef.current = null;
    }
  };

  /** Persisted transcript → turns. Assistant rows pair with the user row before them; a
   * user row with no assistant row (the service restarted mid-confirmation) stands alone.
   * Past auto-navigations restore as SUGGEST buttons — "Opened" would be false now. */
  const mapHistoryToTurns = (detail: AssistantConversationDetail): Turn[] => {
    const restored: Turn[] = [];
    for (const message of detail.messages) {
      const last = restored[restored.length - 1];
      if (message.role === "user" || !last || last.answer !== "") {
        restored.push({
          id: nextId.current++,
          question: message.role === "user" ? message.content : "",
          answer: "",
          status: "done",
          toolLabel: null,
          citations: [],
          navigations: [],
          confirmations: [],
          messageId: null,
          feedback: null,
        });
      }
      if (message.role === "assistant") {
        const turn = restored[restored.length - 1]!;
        turn.answer = message.content;
        turn.citations = message.citations ?? [];
        turn.navigations = (message.navigations ?? []).map((nav) => ({
          ...nav,
          mode: "suggest" as const,
        }));
        turn.messageId = message.id;
        turn.feedback = message.feedbackRating;
      }
    }
    // Confirmation cards still paused server-side belong to the newest turn — restoring
    // them is what lets a reopened conversation decide (or unblock) the pending write.
    // If the transcript came back empty (its user row was lost), a synthetic turn still
    // carries the cards: dropping them would wedge the thread behind 409s.
    if (detail.pending.length > 0) {
      if (restored.length === 0) {
        restored.push({
          id: nextId.current++,
          question: "",
          answer: "",
          status: "done",
          toolLabel: null,
          citations: [],
          navigations: [],
          confirmations: [],
          messageId: null,
          feedback: null,
        });
      }
      const last = restored[restored.length - 1]!;
      last.status = "confirm";
      if (detail.pendingAnswer) last.answer = detail.pendingAnswer;
      last.confirmations = detail.pending.map((p) => ({
        ...p,
        decision: "pending" as const,
      }));
    }
    return restored;
  };

  const openHistory = async () => {
    setView("history");
    setHistoryState("loading");
    try {
      setConversations(await listConversations());
      setHistoryState("ready");
    } catch {
      setHistoryState("error");
    }
  };

  const openConversation = async (thread: string) => {
    if (streamBusy || openingThread) return;
    const epoch = ++openEpoch.current;
    setOpeningThread(thread);
    setDetailError(false);
    try {
      const detail = await getConversation(thread);
      // The user moved on while this was in flight (backed out to chat, sent a
      // message, opened another conversation) — applying it now would replace the
      // turns under them and orphan any live stream.
      if (epoch !== openEpoch.current) return;
      threadId.current = detail.threadId;
      resolvedConfirmations.current.clear();
      turnAutoNav.current.clear();
      setTurns(mapHistoryToTurns(detail));
      setView("chat");
      inputRef.current?.focus();
    } catch {
      if (epoch === openEpoch.current) setDetailError(true);
    } finally {
      if (epoch === openEpoch.current) setOpeningThread(null);
    }
  };

  const startNewChat = () => {
    openEpoch.current++;
    threadId.current = null;
    resolvedConfirmations.current.clear();
    turnAutoNav.current.clear();
    setTurns([]);
    setView("chat");
    inputRef.current?.focus();
  };

  /** 👍/👎 an assistant reply. Not optimistic: the filled thumb + thanks only render
   * once the rating is saved — a failure shows an error instead of silently reverting. */
  const rateTurn = async (
    turnId: number,
    messageId: number | null,
    rating: "up" | "down",
  ) => {
    if (messageId == null) return;
    const current = turns.find((x) => x.id === turnId);
    if (!current || current.feedbackBusy || current.feedback === rating) return;
    patchTurn(turnId, { feedbackBusy: true, feedbackError: false });
    try {
      await sendAssistantFeedback(messageId, rating);
      patchTurn(turnId, { feedback: rating, feedbackBusy: false });
    } catch {
      patchTurn(turnId, { feedbackBusy: false, feedbackError: true });
    }
  };

  const formatConversationDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Drag the expanded panel by its header. Pointer capture covers mouse, touch, and pen.
  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!expanded) return;
    if ((e.target as HTMLElement).closest("button")) return; // let the header buttons work
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: drag.x, oy: drag.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const s = dragStart.current;
    if (!s) return;
    setDrag({ x: s.ox + (e.clientX - s.mx), y: s.oy + (e.clientY - s.my) });
  };
  const endDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <>
      {/* Launcher — z-60 so it sits above the course player's fullscreen z-50 overlay */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ask.open")}
        aria-expanded={open}
        className={cn(
          "fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
          open && "pointer-events-none scale-0 opacity-0",
        )}
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Chat panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t("ask.title")}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        style={{
          ...(expanded ? PANEL_EXPANDED : PANEL_DOCKED),
          transform: `translate(${drag.x}px, ${drag.y}px) scale(${open ? (dragging ? 1.02 : 1) : 0.95})`,
          // While dragging, track the pointer 1:1 (no transform transition) but let the
          // lift shadow ease in — unless reduced motion is requested.
          transition: dragging
            ? prefersReducedMotion()
              ? "none"
              : "box-shadow 200ms ease-out"
            : undefined,
        }}
        className={cn(
          "fixed z-[60] flex origin-bottom-right flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 ease-out motion-reduce:transition-none",
          dragging ? "shadow-[0_24px_64px_-8px_rgba(0,0,0,0.55)]" : "shadow-lg",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* Header (drag handle when expanded) */}
        <header
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          className={cn(
            "flex items-center gap-2 border-b border-border px-4 py-3",
            expanded && "cursor-move touch-none select-none",
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{t("ask.title")}</p>
            <p className="truncate text-xs text-muted-foreground">{t("ask.subtitle")}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("ask.newChat")}
            disabled={streamBusy}
            onClick={startNewChat}
          >
            <SquarePen className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 shrink-0", view === "history" && "bg-accent")}
            aria-label={t("ask.historyButton")}
            aria-pressed={view === "history"}
            disabled={streamBusy}
            onClick={() => {
              if (view === "history") {
                openEpoch.current++; // backing out invalidates any in-flight open
                setView("chat");
              } else {
                void openHistory();
              }
            }}
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={expanded ? t("ask.collapse") : t("ask.expand")}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("ask.close")}
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        {/* History (A6): pick a saved conversation to continue it */}
        {view === "history" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {historyState === "loading" && <ThinkingDots label={t("ask.asking")} />}
            {historyState === "error" && (
              <p className="text-sm text-destructive">{t("ask.error")}</p>
            )}
            {historyState === "ready" && conversations.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <History className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("ask.historyEmpty")}</p>
              </div>
            )}
            {historyState === "ready" && conversations.length > 0 && (
              <>
                {detailError && (
                  <p className="px-3 pb-2 text-sm text-destructive">{t("ask.error")}</p>
                )}
                <ul className="space-y-1">
                  {conversations.map((c) => (
                    <li key={c.threadId}>
                      <button
                        type="button"
                        disabled={openingThread !== null}
                        onClick={() => void openConversation(c.threadId)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
                          openingThread !== null &&
                            openingThread !== c.threadId &&
                            "opacity-50",
                        )}
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {c.title || t("ask.historyUntitled")}
                        </p>
                        {c.updatedAt && (
                          <p className="text-xs text-muted-foreground">
                            {formatConversationDate(c.updatedAt)}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Conversation */}
        <div
          ref={scrollRef}
          className={cn(
            "flex-1 space-y-4 overflow-y-auto px-4 py-4",
            view === "history" && "hidden",
          )}
        >
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {scope ? t("ask.empty") : t("ask.emptyGlobal")}
              </p>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-2">
              {/* Learner question (empty only on odd restored transcripts) */}
              {turn.question !== "" && (
                <div className="flex justify-end">
                  <p className="ey-animate-fade-up max-w-[85%] break-words rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm text-foreground">
                    {turn.question}
                  </p>
                </div>
              )}

              {/* Assistant reply: thinking → (streamed text +) tool status → answer.
                  A restored turn whose reply never happened (restart mid-confirmation)
                  has nothing to show — skip the empty bubble. */}
              {(turn.status !== "done" ||
                turn.answer !== "" ||
                turn.confirmations.length > 0 ||
                turn.citations.length > 0 ||
                turn.navigations.length > 0) && (
              <div className="flex justify-start">
                {turn.status === "waiting" ? (
                  <ThinkingDots label={t("ask.asking")} />
                ) : (
                  <div className="ey-animate-fade-up max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-muted/40 px-3 py-2">
                    {turn.answer !== "" &&
                      (turn.status === "error" ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-destructive">
                          {turn.answer}
                        </p>
                      ) : (
                        <div
                          className="article-body break-words text-sm leading-relaxed text-foreground"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(turn.answer) }}
                        />
                      ))}

                    {/* Keep any already-streamed text visible while a tool runs */}
                    {turn.status === "tool" && (
                      <div className="flex w-fit items-center gap-2">
                        <span className="ey-typing-dot h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{turn.toolLabel}</p>
                      </div>
                    )}

                    {/* Confirmation cards (A5): a write is paused server-side until the
                        learner explicitly decides here — buttons only, never automatic. */}
                    {turn.confirmations.length > 0 && (
                      <div className="space-y-2 pt-0.5">
                        {turn.confirmations.map((c) => {
                          const isEnrol = c.tool === "enrol_elearning";
                          const cardTitle = isEnrol
                            ? t("ask.confirmEnrol", { title: c.title ?? "" })
                            : t("ask.confirmComplete", { chapter: c.chapterTitle ?? "" });
                          const cardMeta = isEnrol
                            ? typeof c.credits === "number"
                              ? t("ask.confirmEnrolMeta", { credits: c.credits })
                              : null
                            : typeof c.blocksRemaining === "number"
                              ? t("ask.confirmCompleteMeta", { count: c.blocksRemaining })
                              : null;
                          // While another stream is running (e.g. a sibling card's
                          // resume), hold this card's buttons.
                          const holdButtons =
                            turn.status === "waiting" ||
                            turn.status === "tool" ||
                            turn.status === "streaming";
                          return (
                            <div
                              key={c.interruptId}
                              className="rounded-lg border border-border bg-background p-3"
                            >
                              <p className="text-sm font-medium text-foreground">
                                {cardTitle}
                              </p>
                              {cardMeta && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {cardMeta}
                                </p>
                              )}
                              {c.decision === "pending" ? (
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    disabled={holdButtons}
                                    onClick={() =>
                                      void resolveConfirmation(
                                        turn.id,
                                        c.interruptId,
                                        true,
                                        c.tool,
                                      )
                                    }
                                  >
                                    <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                                    {t("ask.approve")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-3 text-xs"
                                    disabled={holdButtons}
                                    onClick={() =>
                                      void resolveConfirmation(
                                        turn.id,
                                        c.interruptId,
                                        false,
                                        c.tool,
                                      )
                                    }
                                  >
                                    <X className="mr-1 h-3 w-3" aria-hidden="true" />
                                    {t("ask.decline")}
                                  </Button>
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {c.decision === "approved"
                                    ? t("ask.confirmApproved")
                                    : c.decision === "declined"
                                      ? t("ask.confirmDeclined")
                                      : t("ask.confirmExpired")}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {turn.status === "done" && turn.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {turn.citations.map((c, i) => {
                          const label = c.courseTitle
                            ? `${c.courseTitle} — ${c.blockTitle ?? t("ask.sources")}`
                            : (c.blockTitle ?? t("ask.sources"));
                          // In the cited chapter → scroll to the block; anywhere else →
                          // open that course's player deep-linked to the chapter.
                          const jumpable = scope?.chapterId === c.chapterId;
                          return (
                            <button
                              key={`${c.contentBlockId}-${i}`}
                              type="button"
                              onClick={() =>
                                jumpable
                                  ? scrollToBlock(c.contentBlockId)
                                  : router.push(
                                      `/training/${c.trainingId}/learn?chapter=${c.chapterId}`,
                                    )
                              }
                              className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <FileText className="h-3 w-3" aria-hidden="true" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {turn.navigations.some(
                      (n) => n.mode === "auto" || turn.status === "done",
                    ) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {turn.navigations.map((nav, i) => {
                          // Auto pills report an action that already happened — show
                          // immediately. Suggest buttons wait for the finished reply
                          // that explains them (and never render on error turns).
                          if (nav.mode === "suggest" && turn.status !== "done")
                            return null;
                          const path = destinationPath(nav.destination);
                          if (!path) return null;
                          const text =
                            nav.label ||
                            t(`ask.dest.${destinationKey(nav.destination)}`);
                          return nav.mode === "auto" ? (
                            <span
                              key={`${nav.destination}-${i}`}
                              className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                              {t("ask.navOpened")} — {text}
                            </span>
                          ) : (
                            <button
                              key={`${nav.destination}-${i}`}
                              type="button"
                              onClick={() => router.push(path)}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              {text}
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 👍/👎 on the finished, persisted reply (A6) */}
                    {turn.status === "done" && turn.messageId != null && (
                      <div
                        role="group"
                        aria-label={t("ask.feedbackPrompt")}
                        className="flex items-center gap-0.5 pt-0.5"
                      >
                        <button
                          type="button"
                          aria-label={t("ask.thumbsUp")}
                          aria-pressed={turn.feedback === "up"}
                          disabled={turn.feedbackBusy}
                          onClick={() => void rateTurn(turn.id, turn.messageId, "up")}
                          className={cn(
                            "rounded-md p-1 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                            turn.feedback === "up"
                              ? "text-foreground"
                              : "text-muted-foreground/60",
                          )}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("ask.thumbsDown")}
                          aria-pressed={turn.feedback === "down"}
                          disabled={turn.feedbackBusy}
                          onClick={() => void rateTurn(turn.id, turn.messageId, "down")}
                          className={cn(
                            "rounded-md p-1 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                            turn.feedback === "down"
                              ? "text-foreground"
                              : "text-muted-foreground/60",
                          )}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {turn.feedback && !turn.feedbackError && (
                          <span className="pl-1 text-xs text-muted-foreground">
                            {t("ask.feedbackThanks")}
                          </span>
                        )}
                        {turn.feedbackError && (
                          <span className="pl-1 text-xs text-destructive">
                            {t("ask.feedbackError")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
          ))}
        </div>

        {/* Composer (chat view only) */}
        <div className={cn("border-t border-border p-3", view === "history" && "hidden")}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
              aria-label={t("ask.placeholder")}
              placeholder={t("ask.placeholder")}
              className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => void submit()}
              disabled={busy || !question.trim()}
              aria-label={t("ask.askButton")}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
