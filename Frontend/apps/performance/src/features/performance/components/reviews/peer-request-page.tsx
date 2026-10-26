"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PeerRequestDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageContainer, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { PersonInitials } from "@repo/performance-ui";
import { Ban, Eye, Lock, Send } from "@/lib/icons";
import { usePeerRequest, usePeerRequestCommands } from "../../api/use-review-work";
import { ContentUnavailable } from "../content-unavailable";
import { PerformancePageHeading } from "../performance-page-heading";
import { DueChip, dayLabel } from "./review-parts";
import { formatTime } from "@repo/ds/lib/dates";

/**
 * A colleague's input on someone's review (R4b, board 11): one column, the questions as a page, who reads the answers.
 * Answers save as you write and lock once sent; declining takes an optional note.
 */
export function PeerRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const query = usePeerRequest(requestId);
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="This request" />;
  if (!query.data) return <PageSkeleton rows={5} label="Loading the request" />;
  return <PeerRequestForm request={query.data} />;
}

function PeerRequestForm({ request }: { request: PeerRequestDto }) {
  const router = useRouter();
  const commands = usePeerRequestCommands(request.id);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.questions.map((q) => [q.questionId, q.answer ?? ""])));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const dirty = useRef(false);
  const first = request.subjectDisplayName.split(" ")[0] ?? request.subjectDisplayName;
  const editable = request.canAnswer;

  // Autosave a moment after typing stops.
  useEffect(() => {
    if (!editable || !dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      commands.save.mutateAsync(Object.entries(answers).map(([questionId, text]) => ({ questionId, text })))
        .then(() => setSavedAt(new Date())).catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [answers, editable, commands.save]);

  const send = async () => {
    const empty = request.questions.filter((q) => !answers[q.questionId]?.trim()).map((q) => q.questionId);
    setMissing(empty);
    if (empty.length) return;
    try {
      await commands.send.mutateAsync(Object.entries(answers).map(([questionId, text]) => ({ questionId, text })));
      toast.success(`Your input for ${first} was sent.`);
      router.push("/reviews");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your input couldn't be sent.");
    }
  };

  const decline = async () => {
    try {
      await commands.decline.mutateAsync(note.trim() || null);
      toast.success("You declined this request.");
      router.push("/reviews");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The request couldn't be declined.");
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <PerformancePageHeading
          back={{ href: "/reviews", label: "Reviews" }}
          leading={<PersonInitials name={request.subjectDisplayName} size="xl" />}
          eyebrow={<span className="type-meta text-muted-foreground">Input for a {request.reviewRoundName.toLowerCase()}</span>}
          title={request.subjectDisplayName}
          actions={request.state === "Open" ? <DueChip date={request.dueDate} late={request.daysLate > 0} label={`Due ${dayLabel(request.dueDate)}`} />
            : <StatusBadge tone={request.state === "Answered" ? "success" : "muted"} dot>{request.state === "Answered" ? "Sent" : request.state}</StatusBadge>}
        />

        <div className="flex flex-wrap items-center gap-3 rounded-surface bg-card px-4 py-3">
          <Eye className="size-4 text-muted-foreground" aria-hidden />
          <span className="type-label text-foreground">Read by</span>
          <span className="ms-auto flex flex-wrap items-center gap-3">
            <span className="type-body text-foreground">{first}&apos;s reviewer</span>
            <span className="type-body text-foreground">HR</span>
            <span className="inline-flex items-center gap-1 type-meta text-muted-foreground"><Lock className="size-3.5" aria-hidden />Not {first}</span>
          </span>
        </div>

        {request.state === "Declined" ? (
          <p className="mt-8 type-body-secondary text-muted-foreground">You declined this request{request.declineNote ? `: “${request.declineNote}”` : "."}</p>
        ) : request.state === "Closed" ? (
          <p className="mt-8 type-body-secondary text-muted-foreground">{first}&apos;s review moved on before your input was sent, so this request is closed.</p>
        ) : null}

        {request.state !== "Declined" ? (
          <ol className="mt-8 space-y-8">
            {request.questions.map((question, index) => (
              <li key={question.questionId}>
                <p className="type-meta text-muted-foreground">{index + 1} of {request.questions.length}</p>
                <label htmlFor={`answer-${question.questionId}`} className="mt-1.5 block type-subsection-title text-foreground">{question.text}</label>
                <Textarea
                  id={`answer-${question.questionId}`}
                  className="mt-3 min-h-28 type-narrative"
                  maxLength={2000}
                  readOnly={!editable}
                  placeholder={editable ? "Write your answer" : undefined}
                  aria-invalid={missing.includes(question.questionId) || undefined}
                  value={answers[question.questionId] ?? ""}
                  onChange={(event) => {
                    dirty.current = true;
                    setMissing((current) => current.filter((id) => id !== question.questionId));
                    setAnswers((current) => ({ ...current, [question.questionId]: event.target.value }));
                  }}
                />
                {missing.includes(question.questionId) ? <p className="mt-1.5 type-meta text-destructive">Answer this question before sending.</p> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {editable ? (
          <div className="mt-8 border-t border-border pt-5">
            {declining ? (
              <div className="space-y-3">
                <label htmlFor="decline-note" className="type-label text-foreground">Why you&apos;re declining (optional)</label>
                <Textarea id="decline-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}
                  placeholder={`Haven't worked with ${first} since March`} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeclining(false)}>Keep answering</Button>
                  <AsyncButton variant="outline" pending={commands.decline.isLoading} onClick={() => void decline()}>Decline request</AsyncButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" onClick={() => setDeclining(true)}><Ban className="size-4" aria-hidden />Decline</Button>
                <span className="ms-auto type-meta text-muted-foreground">
                  {commands.save.isLoading ? "Saving…" : savedAt ? `Saved ${formatTime(savedAt)}` : null}
                </span>
                <AsyncButton pending={commands.send.isLoading} onClick={() => void send()}><Send className="size-4" aria-hidden />Send input</AsyncButton>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
