"use client";

import { useState } from "react";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { useFeedbackList } from "../../../api/use-conversations";
import { FeedbackComposer, RequestComposer } from "../../conversations/composers";
import { FeedbackDrawer } from "../../conversations/drawers";
import { FeedbackCard } from "../../conversations/feedback-workspace";
import type { ObjectiveRecord } from "../objective-record-model";
import { RecordSection } from "./record-primitives";
import { useTranslations } from "next-intl";

/**
 * Feedback about this objective that the viewer may read (D-13, R3), with the one action that fits them: its owner
 * asks colleagues about it; anyone else gives its owner feedback about it. Feedback opens over the record.
 */
export function FeedbackSection({ record }: { record: ObjectiveRecord }) {
  const t = useTranslations("objective.FeedbackSection");
  const { canGiveFeedback, canAskForFeedback } = record.source;
  const list = useFeedbackList({ cycleId: record.ref.cycleId, objectiveId: record.ref.objectiveId, limit: 20 });
  const [composing, setComposing] = useState<"give" | "ask" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const items = list.data?.items ?? [];
  const objective = { cycleId: record.ref.cycleId, objectiveId: record.ref.objectiveId, title: record.title };

  if (!canGiveFeedback && !canAskForFeedback && items.length === 0) return null;

  const action = canAskForFeedback ? (
    <Button variant="outline" size="sm" onClick={() => setComposing("ask")}>{t("askForFeedbackOnThis")}</Button>
  ) : canGiveFeedback ? (
    <Button variant="outline" size="sm" onClick={() => setComposing("give")}>{t("giveFeedback")}</Button>
  ) : undefined;

  return (
    <RecordSection label={items.length > 0 ? t("feedback", { length: items.length }) : t("feedback2")} action={action}>
      {list.isLoading ? (
        <Skeleton className="h-16 w-full rounded-surface" />
      ) : items.length === 0 ? (
        <p className="type-body text-muted-foreground">{t("noFeedbackAboutThisObjective")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => <FeedbackCard key={item.id} feedback={item} view="received" onOpen={setOpen} hideSubject />)}
        </ul>
      )}
      <FeedbackDrawer feedbackId={open} initial={items.find((item) => item.id === open)} onClose={() => setOpen(null)} />
      {composing === "give" ? (
        <FeedbackComposer
          receiver={{ employeeId: record.accountable.id, displayName: record.accountable.name ?? "Its owner", subtitle: null }}
          objective={objective}
          onClose={() => setComposing(null)}
        />
      ) : null}
      {composing === "ask" ? <RequestComposer objective={objective} onClose={() => setComposing(null)} /> : null}
    </RecordSection>
  );
}
