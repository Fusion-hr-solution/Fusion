import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function InvitationWordmark({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-[0.8125rem] font-semibold uppercase tracking-[0.24em]",
        className
      )}
    >
      Fusion
    </p>
  );
}

/**
 * Shared public transaction frame for every Fusion invitation purpose. The
 * context panel establishes who issued the invitation; the quiet task surface
 * keeps account creation focused. Purpose-specific copy and fields stay with
 * the owning journey.
 */
export function InvitationTransactionFrame({
  context,
  children,
}: {
  context: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[44fr_56fr]">
      <div className="relative overflow-hidden border-b border-[hsl(240_8%_18%)] bg-[hsl(240_14%_8%)] px-6 py-12 text-[hsl(0_0%_98%)] sm:px-10 lg:border-b-0 lg:border-r lg:py-16">
        <div className="relative h-full">{context}</div>
      </div>
      <div className="relative flex items-center justify-center bg-background px-6 py-12 dark:bg-[hsl(240_13%_11%)] sm:px-10 lg:py-16">
        <div className="relative w-full max-w-[34rem] lg:max-w-[28rem]">
          {children}
        </div>
      </div>
    </main>
  );
}

/** Shared token-resolution state. It preserves the split transaction geometry
 * while the server determines which invitation journey is safe to show. */
export function InvitationTransactionLoading() {
  return (
    <InvitationTransactionFrame
      context={
        <div className="mx-auto flex h-full max-w-[34rem] flex-col lg:max-w-[33rem]" aria-hidden="true">
          <InvitationWordmark />
          <div className="mt-12 animate-pulse motion-reduce:animate-none lg:mt-16">
            <div className="h-7 w-44 rounded-lg bg-white/[0.08]" />
            <div className="mt-3 h-12 w-full rounded-lg bg-white/[0.1]" />
            <div className="mt-3 h-12 w-2/3 rounded-lg bg-white/[0.08]" />
            <div className="mt-8 h-4 w-5/6 rounded bg-white/[0.06]" />
          </div>
        </div>
      }
    >
      <div className="animate-pulse space-y-5 motion-reduce:animate-none" aria-label="Loading invitation">
        <div className="h-8 w-3/4 rounded-lg bg-muted" />
        <div className="h-16 rounded-2xl bg-muted/60" />
        <div className="h-11 rounded-xl bg-muted" />
        <div className="h-11 rounded-xl bg-muted" />
        <div className="h-11 rounded-xl bg-muted" />
      </div>
    </InvitationTransactionFrame>
  );
}

/** Shared terminal-state composition for invitations that cannot reveal tenant context. */
export function InvitationTransactionTerminalFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 sm:px-10">
      <div className="w-full max-w-[29rem]">
        <InvitationWordmark className="text-foreground" />
        <div className="mt-6 rounded-2xl border bg-background p-7 shadow-raised sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
