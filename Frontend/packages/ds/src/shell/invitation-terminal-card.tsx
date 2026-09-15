import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

/**
 * The body of a terminal invitation state, rendered inside
 * `InvitationTransactionTerminalFrame`. One semantic glyph, a title, a
 * plain-language explanation, and — where one exists — the single real recovery.
 *
 * Prop-driven: the owning journey maps its own stopping points to an icon, a
 * variant, and copy. Only the two states where activation actually succeeded
 * should read as `resolved`; everything else is an `error`.
 */
export function InvitationTerminalCard({
  variant,
  icon: Icon,
  title,
  detail,
  action,
}: {
  variant: "resolved" | "error";
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}) {
  const resolved = variant === "resolved";

  return (
    <div>
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl",
          resolved
            ? "bg-foreground/[0.06] text-foreground ring-1 ring-inset ring-foreground/10"
            : "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20"
        )}
      >
        <Icon aria-hidden="true" className="size-[1.375rem]" />
      </span>

      <h1 className="mt-6 font-heading text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-7 text-muted-foreground">
        {detail}
      </p>

      {action ? (
        <Button
          asChild
          size="lg"
          className="group mt-8 h-11 rounded-control px-5 font-semibold"
        >
          <a href={action.href}>
            {action.label}
            <ArrowRight
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </Button>
      ) : null}
    </div>
  );
}
