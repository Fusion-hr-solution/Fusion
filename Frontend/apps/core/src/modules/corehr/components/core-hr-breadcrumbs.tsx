import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function CoreHrBreadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ch-secondary font-chHeadline",
        className
      )}
      aria-label="Breadcrumb"
    >
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
            )}
            {c.href && !isLast ? (
              <Link
                href={c.href}
                className="transition-colors hover:text-ch-on-surface"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={isLast ? "text-ch-on-surface" : undefined}
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
