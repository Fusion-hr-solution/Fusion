"use client";

import { Skeleton } from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { ImportHeader } from "./import-header";
import type { ImportStep } from "./import-stepper";

// One skeleton per import stage, shaped like the stage it stands in for. The route loading
// boundaries, the access gate and the attempt frame all render these, so loading a stage
// reads as that stage filling in rather than a generic loader swapping out.

export type ImportSkeletonStage = "upload" | "match" | "review";

const CONTEXT =
  "Bring in your structure from Excel or CSV and review it before publishing.";

function skeletonSteps(stage: ImportSkeletonStage | null): ImportStep[] {
  const at =
    stage === "match"
      ? 1
      : stage === "review"
        ? 2
        : stage === "upload"
          ? 0
          : -1;
  return ["Upload", "Match", "Review"].map((label, index) => ({
    key: label.toLowerCase(),
    label,
    state: index < at ? "done" : index === at ? "current" : "upcoming",
  }));
}

function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}

/** Upload: the header, the file-and-date card, and the template action. */
export function ImportUploadSkeleton() {
  return (
    <LoadingRegion label="Loading Organization import">
      <PageContainer className="space-y-8 pb-16">
        <ImportHeader context={CONTEXT} steps={skeletonSteps("upload")} />
        <section className="rounded-surface border border-border bg-card p-5 shadow-raised sm:p-8">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          <Skeleton className="mt-6 h-24 w-full rounded-object" />
          <Skeleton className="mt-7 h-4 w-28" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 min-w-56 flex-1 basis-64 rounded-object sm:max-w-md" />
            <div className="ml-auto flex items-center gap-3">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-20" />
            </div>
          </div>
        </section>
        <div className="flex items-center gap-4 rounded-surface border border-border bg-card p-5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </PageContainer>
    </LoadingRegion>
  );
}

/** An attempt still resolving its stage: the frame's header, then a quiet body. */
export function ImportAttemptSkeleton({
  stage,
}: {
  stage: ImportSkeletonStage | null;
}) {
  return (
    <LoadingRegion label="Loading your import">
      <PageContainer>
        <ImportHeader context={CONTEXT} steps={skeletonSteps(stage)} />
      </PageContainer>
      {stage === "match" ? (
        <MatchBody />
      ) : stage === "review" ? (
        <ReviewBody />
      ) : (
        <PageContainer className="pt-2">
          <Skeleton className="h-24 rounded-surface" />
        </PageContainer>
      )}
    </LoadingRegion>
  );
}

/** Match body, inside the attempt frame. */
export function ImportMatchSkeleton() {
  return (
    <LoadingRegion label="Loading Match">
      <MatchBody />
    </LoadingRegion>
  );
}

/** Review body, inside the attempt frame. */
export function ImportReviewSkeleton() {
  return (
    <LoadingRegion label="Loading Review">
      <ReviewBody />
    </LoadingRegion>
  );
}

function MatchBody() {
  return (
    <>
      <PageContainer className="space-y-6 pt-2">
        <BannerSkeleton metrics={3} />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
          <div className="min-w-0 space-y-6">
            <Panel>
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4"
                  >
                    <Skeleton className="h-9 rounded-object" />
                    <Skeleton className="h-9 rounded-object" />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <Skeleton className="h-5 w-48" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 rounded-object" />
                ))}
              </div>
            </Panel>
          </div>
          <aside className="min-w-0 space-y-6">
            <Panel>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-4 h-52 rounded-object" />
            </Panel>
            <Panel>
              <Skeleton className="h-5 w-28" />
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-4"
                    style={{ width: `${80 - index * 15}%` }}
                  />
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      </PageContainer>
      <FooterSkeleton />
    </>
  );
}

/** Indent depth of each placeholder row, so the tree reads as a hierarchy while loading. */
const TREE_DEPTHS = [0, 1, 2, 2, 1, 2, 3, 3, 1];

function ReviewBody() {
  return (
    <>
      <PageContainer className="space-y-6 pt-2">
        <BannerSkeleton metrics={4} />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <Panel>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-4 h-9 w-full rounded-object sm:max-w-md" />
            <div className="mt-4 space-y-3">
              {TREE_DEPTHS.map((depth, index) => (
                <Skeleton
                  key={index}
                  className="h-7 rounded-object"
                  style={{
                    marginInlineStart: `${depth * 1.5}rem`,
                    width: `${55 - depth * 6}%`,
                  }}
                />
              ))}
            </div>
          </Panel>
          <aside className="min-w-0 space-y-6">
            <Panel>
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-object" />
                ))}
              </div>
            </Panel>
            <Panel>
              <Skeleton className="h-5 w-24" />
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="size-5 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      </PageContainer>
      <FooterSkeleton />
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-surface border border-border bg-card p-5">
      {children}
    </section>
  );
}

function BannerSkeleton({ metrics }: { metrics: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-surface border border-border bg-card p-4 sm:pr-6">
      <div className="flex min-w-0 flex-[2] basis-80 items-center gap-4">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        {Array.from({ length: metrics }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-5 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FooterSkeleton() {
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <PageContainer className="flex items-center justify-between gap-4 py-3">
        <Skeleton className="h-9 w-28" />
        <div className="flex items-center gap-4">
          <Skeleton className="hidden h-4 w-40 sm:block" />
          <Skeleton className="h-9 w-40" />
        </div>
      </PageContainer>
    </div>
  );
}
