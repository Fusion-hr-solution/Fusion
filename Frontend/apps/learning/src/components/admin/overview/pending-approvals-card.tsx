import { ClipboardList, Check, CheckCircle2 } from "lucide-react";
import { OverviewCard } from "./overview-card";
import {
  APPROVAL_TYPE_ICON,
  initialsOf,
  type PendingApproval,
} from "@/data/admin-overview";

interface PendingApprovalsCardProps {
  approvals: PendingApproval[];
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}

export function PendingApprovalsCard({
  approvals,
  onApprove,
  onDecline,
}: PendingApprovalsCardProps) {
  return (
    <OverviewCard
      icon={ClipboardList}
      title="Pending Approvals"
      iconClassName="bg-[hsl(var(--ey-orange-500))]/15"
      iconColorClassName="text-[hsl(var(--ey-orange-500))]"
      action={
        approvals.length > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full ey-bg-accent px-1.5 text-xs font-bold text-[hsl(var(--ey-black))] tabular-nums">
            {approvals.length}
          </span>
        ) : null
      }
    >
      {approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-9 text-center">
          <CheckCircle2
            className="h-8 w-8 text-[hsl(var(--ey-green-500))]"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground">
            No approvals waiting on you.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-3.5">
          {approvals.map((approval) => {
            const TypeIcon = APPROVAL_TYPE_ICON[approval.type];
            return (
              <div
                key={approval.id}
                className="ey-animate-fade-up rounded-xl border border-border/60 bg-muted/40 p-3"
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ey-bg-dark text-[11px] font-bold text-white ring-1 ring-border">
                    {initialsOf(approval.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      {approval.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {approval.training}
                    </p>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                    <TypeIcon className="h-3 w-3" aria-hidden="true" />
                    {approval.type}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {approval.date}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onApprove(approval.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg ey-bg-dark px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[hsl(var(--ey-black))] hover:shadow-md"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecline(approval.id)}
                    className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:bg-muted"
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OverviewCard>
  );
}
