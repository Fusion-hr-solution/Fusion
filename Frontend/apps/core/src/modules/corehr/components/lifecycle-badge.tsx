import { cn } from "@/lib/utils";
import type { OrganizationLifecycle } from "../types/organization";

const LABEL: Record<OrganizationLifecycle, string> = {
  active: "Active",
  invited: "Invited",
  attention: "Attention Needed",
  suspended: "Suspended",
};

export function LifecycleBadge({
  lifecycle,
  className,
}: {
  lifecycle: OrganizationLifecycle;
  className?: string;
}) {
  const palette =
    lifecycle === "active"
      ? "bg-ch-tertiary/10 text-ch-tertiary"
      : lifecycle === "attention"
        ? "bg-ch-error/10 text-ch-error"
        : lifecycle === "invited"
          ? "bg-ch-primary/10 text-ch-primary"
          : "bg-stone-200 text-stone-600";

  const dot =
    lifecycle === "active"
      ? "bg-ch-tertiary"
      : lifecycle === "attention"
        ? "bg-ch-error"
        : lifecycle === "invited"
          ? "bg-ch-primary"
          : "bg-stone-600";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
        palette,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {LABEL[lifecycle]}
    </span>
  );
}
