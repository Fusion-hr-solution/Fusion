import { cn } from "@/lib/utils";
import type { OrganizationLifecycle } from "../types/organization";

const LABEL: Record<OrganizationLifecycle, string> = {
  draft: "Draft",
  invited: "Invited",
  active: "Active",
  attention: "Attention Needed",
  suspended: "Suspended",
  archived: "Archived",
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
          : lifecycle === "draft"
            ? "bg-stone-200 text-stone-600"
            : lifecycle === "archived"
              ? "bg-stone-300/80 text-stone-700"
              : "bg-stone-200 text-stone-600";

  const dot =
    lifecycle === "active"
      ? "bg-ch-tertiary"
      : lifecycle === "attention"
        ? "bg-ch-error"
        : lifecycle === "invited"
          ? "bg-ch-primary"
          : lifecycle === "draft"
            ? "bg-stone-500"
            : lifecycle === "archived"
              ? "bg-stone-500"
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
