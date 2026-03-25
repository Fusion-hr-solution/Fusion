import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  linkHref?: string;
  linkLabel?: string;
}

export function SectionHeader({
  icon: Icon,
  iconClassName = "ey-bg-dark",
  title,
  linkHref,
  linkLabel,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClassName}`}
        >
          <Icon className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--ey-blue-600))] hover:underline transition-colors"
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
