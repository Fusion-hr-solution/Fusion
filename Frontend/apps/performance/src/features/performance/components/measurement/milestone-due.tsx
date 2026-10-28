import { cn } from "@repo/ds/lib/utils";
import { formatDate } from "@repo/ds/lib/dates";
import { useTranslations } from "next-intl";

type DatedMilestone = { dueDate: string | null; isCompleted: boolean };

/** Today as a local `YYYY-MM-DD`, comparable with milestone due dates as plain strings. */
function todayISO(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** An open milestone whose due date has passed — a fact about dates, never a judgement. */
export function isMilestoneOverdue(milestone: DatedMilestone, today: string = todayISO()): boolean {
  return !milestone.isCompleted && milestone.dueDate !== null && milestone.dueDate < today;
}

/** "15 Nov", with the year once it is not the current one. */
export function formatMilestoneDue(dueDate: string): string {
  return formatDate(dueDate);
}

/** The open milestones that are overdue, and the next one still ahead — the two date facts surfaces summarise. */
export function milestoneSchedule(milestones: DatedMilestone[]) {
  const today = todayISO();
  const overdue = milestones.filter((m) => isMilestoneOverdue(m, today)).length;
  const next = milestones
    .filter((m) => !m.isCompleted && m.dueDate !== null && m.dueDate >= today)
    .map((m) => m.dueDate!)
    .sort()[0];
  return { overdue, nextDue: next ?? null };
}

/**
 * A milestone's due date as a quiet inline fact: "Due 15 Nov", or "Overdue · 30 Sep" in warning ink
 * when it has passed without completion. Nothing renders for an undated milestone.
 */
export function MilestoneDue({ milestone, className }: { milestone: DatedMilestone; className?: string }) {
  const t = useTranslations("progress.MilestoneDue");
  if (!milestone.dueDate) return null;
  const overdue = isMilestoneOverdue(milestone);
  return (
    <time
      dateTime={milestone.dueDate}
      className={cn(
        "shrink-0 type-meta tabular-nums",
        overdue ? "font-medium text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {overdue ? t("overdue") + " " : t("due") + " "}
      {formatMilestoneDue(milestone.dueDate)}
    </time>
  );
}
