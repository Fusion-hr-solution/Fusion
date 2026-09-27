import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { PageContainer } from "@repo/ds/shell";
import type { SetupStep } from "./setup-readiness";

/*
 * Shape-matched loading states for the cycle-setup journey. Each mirrors the layout it stands in
 * for (header, stepper, hero, step body) so content lands in place instead of replacing a generic
 * list of bars.
 */

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-border bg-card p-6 lg:p-7 ${className}`}>{children}</div>;
}

function CardHeading() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 rounded-lg" />
      <Skeleton className="h-5 w-40" />
    </div>
  );
}

function Field() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function Footer() {
  return (
    <div className="flex items-center justify-between border-t border-border pt-6">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

/** The dark setup hero (Step 1) and launch hero (Step 3) share this silhouette. */
function HeroSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-muted/40 p-7 lg:p-9 ${tall ? "min-h-56" : "min-h-44"}`}
    >
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-8 w-80 max-w-full" />
      <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
      <div className="mt-6 flex flex-wrap gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailsStepSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeading />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field />
            <Field />
            <div className="md:col-span-2">
              <Field />
            </div>
            <Field />
            <Field />
          </div>
        </Card>
        <Card className="space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Footer />
    </div>
  );
}

export function PopulationStepSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Resolving population">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="!p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
          </Card>
        ))}
      </div>
      <Card className="!p-0">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-8 w-40" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
      <Footer />
    </div>
  );
}

/** Summary cards + readiness rail, below the launch hero. */
export function ReviewBodySkeleton() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
      aria-busy
      aria-label="Loading review"
    >
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeading />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-6">
        <Card className="space-y-4">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </Card>
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}

export function ReviewStepSkeleton() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <ReviewBodySkeleton />
      <Footer />
    </div>
  );
}

export function SetupStepSkeleton({ step }: { step: SetupStep }) {
  if (step === "population") return <PopulationStepSkeleton />;
  if (step === "review") return <ReviewStepSkeleton />;
  return <DetailsStepSkeleton />;
}

/** The whole setup shell: header, three-node stepper, (Step 1) hero, and the step body. */
export function SetupShellSkeleton({ step, label }: { step: SetupStep; label?: string }) {
  return (
    <PageContainer>
      <div aria-busy aria-label={label ?? "Loading Cycle setup"}>
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="mt-7 flex items-start">
          {[0, 1, 2].map((i) => (
            <div key={i} className={i === 2 ? "shrink-0" : "flex flex-1 flex-col"}>
              <div className="flex items-center">
                <Skeleton className="size-9 rounded-full" />
                {i < 2 ? <Skeleton className="mx-3 h-0.5 flex-1" /> : null}
              </div>
              <Skeleton className="mt-3 h-4 w-24" />
            </div>
          ))}
        </div>
        {step === "details" ? (
          <div className="mt-7">
            <HeroSkeleton tall />
          </div>
        ) : null}
        <div className="mt-7">
          <SetupStepSkeleton step={step} />
        </div>
      </div>
    </PageContainer>
  );
}

/** The established /cycle surface: context bar, heading, milestone rail, population block. */
export function CycleSurfaceSkeleton() {
  return (
    <PageContainer>
      <div aria-busy aria-label="Loading Cycle" className="space-y-8">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </PageContainer>
  );
}
