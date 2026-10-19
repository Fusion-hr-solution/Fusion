"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@repo/auth";
import { newClientId, type FeedbackDto, type PraiseDto } from "@repo/api";
import { useReactToPraise } from "@repo/api/query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@repo/ds/components/ui/alert-dialog";
import { Button } from "@repo/ds/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { AsyncButton } from "@repo/ds/shell";
import { AvatarStack, PersonInitials, PraiseReactions, ValueChip, joinNames, praiseTime } from "@repo/performance-ui";
import { ArrowRight, Check, Eye, Lock, OneOnOnes } from "@/lib/icons";
import { useDeletePraise, useFeedbackItem, useOneOnOne, useOneOnOneCommands, useOneOnOnes, usePraiseItem } from "../../api/use-conversations";
import { formatDay } from "../one-on-ones/one-on-one-lib";
import { SubjectChip, firstName } from "./conversation-parts";
import { REACTION_ICONS } from "./reaction-icons";

function DrawerFrame({
  open,
  onOpenChange,
  title,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[34rem]">
        <div className="px-7 pt-6 pb-2">
          <SheetTitle className="type-eyebrow text-muted-foreground">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-4 pb-8">{children}</div>
        {footer ? <div className="flex flex-wrap items-center gap-3 border-t border-border bg-popover px-7 py-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

function Unavailable({ text }: { text: string }) {
  return <p className="type-body-secondary text-muted-foreground">{text}</p>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 border-t border-border py-3 first:border-t-0">
      <span className="type-meta text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * One piece of feedback in a reading view (S-12). The words are the record and lead; who, what about, who reads it and
 * the request it answers sit below. Nothing to edit: feedback is fixed once sent.
 */
export function FeedbackDrawer({ feedbackId, initial, onClose }: { feedbackId: string | null; initial?: FeedbackDto; onClose: () => void }) {
  const item = useFeedbackItem(initial ? null : feedbackId);
  const feedback = initial ?? item.data;
  return (
    <DrawerFrame
      open={Boolean(feedbackId)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={feedback ? `Feedback · ${formatDay(feedback.sentAt)}` : "Feedback"}
      footer={
        feedback ? (
          <>
            <span className="flex items-center gap-1.5 type-meta text-muted-foreground"><Lock className="size-3.5" aria-hidden /> Fixed once sent</span>
            <span className="flex-1" />
            <AddToNextOneOnOne feedback={feedback} />
          </>
        ) : null
      }
    >
      {feedback ? (
        <>
          <div className="flex items-center gap-2.5 text-muted-foreground" aria-hidden>
            <PersonInitials name={feedback.author.name} size="lg" />
            <ArrowRight className="size-4" />
            <PersonInitials name={feedback.receiver.name} size="lg" />
          </div>
          <p className="mt-6 type-narrative whitespace-pre-wrap text-foreground">{feedback.message}</p>
          <div className="mt-8">
            <Fact label="From"><span className="type-label text-foreground">{feedback.author.name ?? "A colleague"}</span></Fact>
            <Fact label="To"><span className="type-label text-foreground">{feedback.receiver.name ?? "A colleague"}</span></Fact>
            {feedback.subject ? <Fact label="About"><SubjectChip subject={feedback.subject} link /></Fact> : null}
            <Fact label="Who reads it">
              <span className="flex items-center gap-2 type-body text-foreground">
                {feedback.visibility === "ManagerOnly" ? <Lock className="size-4 text-muted-foreground" aria-hidden /> : <Eye className="size-4 text-muted-foreground" aria-hidden />}
                {feedback.visibility === "ManagerOnly"
                  ? `Only ${feedback.addressedManager?.name ?? "the manager"}`
                  : `${firstName(feedback.receiver.name)} and their manager`}
              </span>
            </Fact>
            {feedback.requestQuestion ? (
              <Fact label="Answers">
                <Link href={`/feedback/requests/${feedback.requestId}`} className="type-body text-foreground hover:underline">{feedback.requestQuestion}</Link>
              </Fact>
            ) : null}
          </div>
        </>
      ) : item.error ? (
        <Unavailable text="This feedback isn't available to you." />
      ) : (
        <div aria-label="Loading feedback" className="space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}
    </DrawerFrame>
  );
}

/**
 * Shared feedback to the caller or one of their reports can go on the next 1:1 with them, when the series offers it
 * as a talking point (the server's rule: since the last meeting, never manager-only).
 */
function AddToNextOneOnOne({ feedback }: { feedback: FeedbackDto }) {
  const { user } = useAuth();
  const list = useOneOnOnes(feedback.visibility === "Shared");
  const row = feedback.receiver.id === user?.employeeId
    ? list.data?.withManager ?? null
    : list.data?.reports.find((r) => r.with.employeeId === feedback.receiver.id) ?? null;
  const series = useOneOnOne(row?.seriesId ?? null);
  const commands = useOneOnOneCommands(row?.seriesId ?? "");
  const meeting = series.data?.upcoming ?? null;
  if (!row || !meeting) return null;

  const onAgenda = meeting.agenda.some((i) => i.sourceKind === "Feedback" && i.sourceId === feedback.id);
  if (onAgenda) {
    return (
      <Link href={`/one-on-ones/${row.seriesId}`} className="flex items-center gap-1.5 type-label text-foreground hover:underline">
        <Check className="size-4 text-success" aria-hidden /> On the next 1:1
      </Link>
    );
  }
  if (!meeting.suggestions.some((s) => s.kind === "Feedback" && s.sourceId === feedback.id)) return null;
  return (
    <AsyncButton
      size="sm"
      variant="outline"
      pending={commands.addAgendaItem.isLoading}
      onClick={async () => {
        try {
          await commands.addAgendaItem.mutateAsync({ meetingId: meeting.id, request: { id: newClientId(), sourceKind: "Feedback", sourceId: feedback.id } });
          toast.success(`Added to your next 1:1 with ${firstName(row.with.displayName)}.`);
        } catch { /* reported by the command */ }
      }}
    >
      <OneOnOnes className="size-4" data-icon="inline-start" /> Add to next 1:1
    </AsyncButton>
  );
}

/** One praise in full: the people praised lead, then the words, the value and the reactions; Delete for its author or HR. */
export function PraiseDrawer({ praiseId, onClose }: { praiseId: string | null; onClose: () => void }) {
  const item = usePraiseItem(praiseId);
  const react = useReactToPraise();
  const remove = useDeletePraise();
  const [confirming, setConfirming] = useState(false);
  const praise: PraiseDto | null | undefined = item.data?.praise;
  const recipients = praise ? joinNames(praise.recipients.map((r) => r.name)) : "";

  return (
    <DrawerFrame
      open={Boolean(praiseId)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Praise"
      footer={praise?.canDelete ? (
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>Delete praise</Button>
      ) : null}
    >
      {item.data?.removed ? (
        <Unavailable text="This praise was removed." />
      ) : praise ? (
        <>
          <div className="flex items-center gap-3">
            <AvatarStack names={praise.recipients.map((r) => r.name)} size="lg" max={4} />
            <div className="min-w-0">
              <p className="type-label text-foreground">{recipients}</p>
              <p className="type-meta text-muted-foreground">
                from {praise.author.name ?? "a colleague"} · <time dateTime={praise.givenAt}>{praiseTime(praise.givenAt)}</time>
              </p>
            </div>
          </div>
          <p className="mt-6 type-narrative whitespace-pre-wrap text-foreground">{praise.message}</p>
          <ValueChip value={praise.value} className="mt-5" />
          <div className="mt-6">
            <PraiseReactions
              praise={praise}
              icons={REACTION_ICONS}
              onReact={(kind, add) => react.mutate({ praiseId: praise.id, kind, add })}
            />
          </div>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this praise?</AlertDialogTitle>
                <AlertDialogDescription>
                  It disappears from the feed, the home and {recipients}&apos;s profile for everyone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await remove.mutateAsync(praise.id);
                      toast.success("Praise deleted.");
                      onClose();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not delete this praise.");
                    }
                  }}
                >
                  Delete praise
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : item.error ? (
        <Unavailable text="This praise isn't available." />
      ) : (
        <div aria-label="Loading praise" className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </DrawerFrame>
  );
}
