"use client";

import { useState } from "react";
import { newClientId, type FeedbackInviteeDto, type FeedbackRequestDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageContainer, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { PersonInitials } from "@repo/performance-ui";
import { Check, Eye, Send } from "@/lib/icons";
import { useFeedbackRequest, useFeedbackRequestCommands } from "../../api/use-conversations";
import { formatDate } from "../../lib";
import { formatDay } from "../one-on-ones/one-on-one-lib";
import { ContentUnavailable } from "../content-unavailable";
import { PerformancePageHeading } from "../performance-page-heading";
import { FEEDBACK_MAX } from "./composers";
import { DueBlock, SubjectChip, firstName } from "./conversation-parts";

/**
 * R8, one feedback request (S-03, D-13). The question is the page. The requester (and their manager or HR) see who
 * was asked and where each stands, then the answers as quotes; an invitee answers on a page of their own, or
 * declines. The due date is shown, never enforced.
 */
export function RequestRecord({ requestId }: { requestId: string }) {
  const query = useFeedbackRequest(requestId);
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="This request" />;
  if (!query.data) return <RequestSkeleton />;
  return <RequestView request={query.data} />;
}

function RequestView({ request }: { request: FeedbackRequestDto }) {
  const commands = useFeedbackRequestCommands(request.id);
  const invitee = request.viewerRole === "Invitee";
  const open = request.state === "Open";
  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl">
        <PerformancePageHeading
          back={{ href: "/feedback?tab=requests", label: "Requests" }}
          eyebrow={
            invitee ? (
              <span className="mb-3 flex items-center gap-3">
                <PersonInitials name={request.requester.name} size="lg" />
                <span className="min-w-0">
                  <span className="block type-label text-foreground">{request.requester.name} asked you</span>
                  <span className="block type-meta text-muted-foreground">{formatDay(request.requestedAt)}</span>
                </span>
              </span>
            ) : (
              <span className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={open ? "success" : "muted"} dot>{open ? "Open" : "Closed"}</StatusBadge>
                <span className="type-meta text-muted-foreground">
                  Asked {formatDay(request.requestedAt)}
                  {open ? ` · due ${formatDate(request.dueDate)}` : request.closedAt ? ` · closed ${formatDay(request.closedAt)}` : ""}
                </span>
              </span>
            )
          }
          title={request.question}
          actions={
            invitee && open ? <DueBlock date={request.dueDate} overdue={request.overdue} />
              : request.can.close ? (
                <AsyncButton variant="outline" pending={commands.close.isLoading} onClick={() => commands.close.mutate()}>
                  Close request
                </AsyncButton>
              ) : null
          }
        />
        {request.subject ? <SubjectChip subject={request.subject} link className="mt-1" /> : null}
        <div className="mt-10 space-y-10">{invitee ? <InviteeView request={request} /> : <FullView request={request} />}</div>
      </div>
    </PageContainer>
  );
}

function statusLine(invitee: FeedbackInviteeDto): { text: string; tone: string } {
  if (invitee.status === "Answered") return { text: `Answered${invitee.respondedAt ? ` ${formatDay(invitee.respondedAt)}` : ""}`, tone: "text-success" };
  if (invitee.status === "Declined") return { text: "Declined", tone: "text-muted-foreground" };
  return { text: "Waiting", tone: "text-muted-foreground" };
}

function FullView({ request }: { request: FeedbackRequestDto }) {
  const invitees = request.invitees ?? [];
  const answers = request.answers ?? [];
  const waiting = invitees.filter((i) => i.status === "Waiting");
  const declined = invitees.filter((i) => i.status === "Declined" && i.declineReason);
  const counts = {
    answered: invitees.filter((i) => i.status === "Answered").length,
    declined: invitees.filter((i) => i.status === "Declined").length,
  };
  return (
    <>
      <section aria-labelledby="asked">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="asked" className="type-section-title text-foreground">Asked</h2>
          <span className="type-meta tabular-nums text-muted-foreground">
            {counts.answered} answered{counts.declined > 0 ? ` · ${counts.declined} declined` : ""}{waiting.length > 0 ? ` · ${waiting.length} waiting` : ""}
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {invitees.map((invitee) => {
            const status = statusLine(invitee);
            return (
              <li key={invitee.person.id} className={cn("flex items-center gap-3 rounded-surface bg-card px-4 py-3", invitee.status === "Declined" && "opacity-60")}>
                <PersonInitials
                  name={invitee.person.name}
                  className={cn("ring-2 ring-offset-2 ring-offset-card", invitee.status === "Answered" ? "ring-success" : invitee.status === "Waiting" ? "ring-border" : "ring-transparent")}
                />
                <span className="min-w-0">
                  <span className="block truncate type-label text-foreground">{invitee.person.name}</span>
                  <span className={cn("block type-meta", status.tone)}>{status.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="answers">
        <h2 id="answers" className="mb-4 flex items-baseline gap-2 type-section-title text-foreground">
          Answers <span className="type-meta tabular-nums text-muted-foreground">{answers.length}</span>
        </h2>
        <ul className="space-y-3">
          {answers.map((answer) => (
            <li key={answer.id} className="rounded-surface bg-card p-6">
              <p className="type-narrative whitespace-pre-wrap text-foreground">{answer.message}</p>
              <div className="mt-5 flex items-center gap-3">
                <PersonInitials name={answer.author.name} />
                <span className="min-w-0 flex-1">
                  <span className="block type-label text-foreground">{answer.author.name}</span>
                  <span className="block type-meta text-muted-foreground">{formatDay(answer.sentAt)}</span>
                </span>
              </div>
            </li>
          ))}
          {request.state === "Open"
            ? waiting.map((invitee) => (
                <li key={invitee.person.id} className="flex items-center gap-3 rounded-surface border border-dashed border-border px-5 py-3.5">
                  <PersonInitials name={invitee.person.name} size="xs" />
                  <span className="flex-1 type-body-secondary text-muted-foreground">{firstName(invitee.person.name)} hasn&apos;t answered yet</span>
                </li>
              ))
            : null}
          {answers.length === 0 && (request.state !== "Open" || waiting.length === 0) ? (
            <li className="type-body-secondary text-muted-foreground">No answers</li>
          ) : null}
        </ul>
        {declined.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {declined.map((invitee) => (
              <li key={invitee.person.id} className="type-meta text-muted-foreground">
                {invitee.person.name} declined: {invitee.declineReason}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

function InviteeView({ request }: { request: FeedbackRequestDto }) {
  const commands = useFeedbackRequestCommands(request.id);
  const [id] = useState(newClientId);
  const [message, setMessage] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const name = firstName(request.requester.name);

  if (request.myAnswer) {
    return (
      <section aria-label="Your answer" className="rounded-surface bg-card p-6">
        <p className="mb-4 flex items-center gap-2 type-label text-success">
          <Check className="size-4" aria-hidden /> Answered {formatDay(request.myAnswer.sentAt)}
        </p>
        <p className="type-narrative whitespace-pre-wrap text-foreground">{request.myAnswer.message}</p>
      </section>
    );
  }
  if (request.mine?.status === "Declined") return <p className="type-body text-muted-foreground">You declined this request.</p>;
  if (!request.can.answer) return <p className="type-body text-muted-foreground">{request.requester.name} closed this request.</p>;

  return (
    <section aria-label="Your answer" className="space-y-5">
      <div className="overflow-hidden rounded-surface bg-card">
        <Label htmlFor="answer-message" className="sr-only">Your feedback for {request.requester.name}</Label>
        <Textarea
          id="answer-message"
          voice="narrative"
          className="min-h-56 resize-y rounded-none border-0 bg-transparent px-6 py-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          maxLength={FEEDBACK_MAX}
          placeholder={`Your answer for ${name}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="flex items-center justify-between gap-3 border-t border-border bg-inlay px-6 py-2.5">
          <span className="flex items-center gap-1.5 type-meta text-muted-foreground">
            <Eye className="size-3.5" aria-hidden /> {name} and their manager read it, with your name
          </span>
          <span className="type-meta tabular-nums text-muted-foreground">{message.length.toLocaleString("en-GB")} / {FEEDBACK_MAX.toLocaleString("en-GB")}</span>
        </div>
      </div>
      {commands.answer.error ? <p className="type-body text-destructive" role="alert">{commands.answer.error.message}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setDeclining((value) => !value)} aria-expanded={declining}>Decline</Button>
        <AsyncButton
          pending={commands.answer.isLoading}
          disabled={!message.trim()}
          onClick={() => commands.answer.mutate({ feedbackId: id, message: message.trim() })}
        >
          <Send className="size-4" data-icon="inline-start" /> Send answer
        </AsyncButton>
      </div>
      {declining ? (
        <div className="space-y-3 rounded-surface border border-border p-4">
          <Label htmlFor="decline-reason">Reason <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="decline-reason" maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
          <AsyncButton variant="outline" pending={commands.decline.isLoading} onClick={() => commands.decline.mutate(reason.trim() || null)}>
            Decline request
          </AsyncButton>
        </div>
      ) : null}
    </section>
  );
}

function RequestSkeleton() {
  return (
    <PageContainer>
      <div role="status" aria-label="Loading this request" className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-8 h-48 w-full rounded-surface" />
      </div>
    </PageContainer>
  );
}
